/**
 * A model read returns its value where it is written.
 *
 * `const user = User.where(...).orderByDesc(...).first()` used to be a pending
 * promise, so `user.email` on the next line was undefined unless the call was
 * awaited. The query builder now answers in place (bun-query-builder 0.4), and
 * nothing this layer wraps around a read may put the promise back: the
 * attribute proxy, the pagination envelope and the decryption of encrypted
 * columns all have to hand on a value when they are given one.
 *
 * Writes are different on purpose. They run setters, validation and lifecycle
 * events, any of which may be asynchronous, so they stay promises.
 */
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { Database } from 'bun:sqlite'
import process from 'node:process'
import { configureOrm, getDatabase } from 'bun-query-builder'
import { acquireDbConfigLock } from '@stacksjs/database'
import { defineModel, modelWritesWait } from '../src/define-model'
import { _clearEncryptedKeyCache, encryptValue } from '../src/utils/encrypted'

const isPromise = (value: unknown): boolean => Boolean(value) && typeof (value as { then?: unknown }).then === 'function'

describe('model reads answer in place', () => {
  let db: Database
  let releaseDbConfigLock: () => void
  const previousKey = process.env.APP_KEY

  const Member = defineModel({
    name: 'RipMember',
    table: 'rip_members',
    primaryKey: 'id',
    autoIncrement: true,
    traits: { useTimestamps: true },
    attributes: {
      email: { type: 'string', fillable: true },
      name: { type: 'string', fillable: true },
    },
  } as const) as any

  const Vault = defineModel({
    name: 'RipVault',
    table: 'rip_vaults',
    primaryKey: 'id',
    autoIncrement: true,
    attributes: {
      label: { type: 'string', fillable: true },
      secret: { type: 'string', fillable: true, encrypted: true },
    },
  } as const) as any

  beforeAll(async () => {
    releaseDbConfigLock = await acquireDbConfigLock()
    process.env.APP_KEY = 'base64:cmVhZHMtaW4tcGxhY2UtdGVzdC1rZXktMzItYnl0ZXM='
    _clearEncryptedKeyCache()
    configureOrm({ database: ':memory:' })
    db = getDatabase()
    db.run('CREATE TABLE rip_members (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT, name TEXT, created_at TEXT, updated_at TEXT)')
    db.run(`INSERT INTO rip_members (email, name, created_at) VALUES
      ('ada@example.com', 'Ada', '2026-01-01 00:00:00'),
      ('grace@example.com', 'Grace', '2026-02-01 00:00:00'),
      ('linus@elsewhere.org', 'Linus', '2026-03-01 00:00:00')`)
    db.run('CREATE TABLE rip_vaults (id INTEGER PRIMARY KEY AUTOINCREMENT, label TEXT, secret TEXT)')
    db.query('INSERT INTO rip_vaults (label, secret) VALUES (?, ?), (?, ?)').run('stripe', await encryptValue('sk_live_123') as string, 'empty', null)
  })

  afterAll(() => {
    if (previousKey === undefined)
      delete process.env.APP_KEY
    else
      process.env.APP_KEY = previousKey
    _clearEncryptedKeyCache()
    releaseDbConfigLock()
  })

  it('the un-awaited chain is the row, with its attributes readable on the next line', async () => {
    const awaited = await Member
      .where('email', 'like', '%@example.com')
      .orderByDesc('created_at')
      .first()
    const user = Member
      .where('email', 'like', '%@example.com')
      .orderByDesc('created_at')
      .first()

    expect(isPromise(user)).toBe(false)
    expect(user.email).toBe('grace@example.com')
    expect(user.name).toBe(awaited.name)
    expect(user.id).toBe(awaited.id)
  })

  it('every read on a model and on a query is a value', () => {
    const reads: Record<string, unknown> = {
      'find': Member.find(1),
      'find (missing)': Member.find(987654),
      'findOrFail': Member.findOrFail(1),
      'first': Member.first(),
      'last': Member.last(),
      'all': Member.all(),
      'count': Member.count(),
      'where().get()': Member.where('id', '>', 1).get(),
      'where().count()': Member.where('id', '>', 1).count(),
      'where().exists()': Member.where('id', 1).exists(),
      'pluck': Member.pluck('name'),
      'paginate': Member.paginate(2),
      'where().paginate()': Member.where('id', '>', 0).paginate(2),
      'simplePaginate': Member.simplePaginate(2),
      'cursorPaginate': Member.cursorPaginate(2),
    }
    for (const [name, value] of Object.entries(reads))
      expect(isPromise(value), `${name} returned a promise`).toBe(false)

    expect((reads.find as any).name).toBe('Ada')
    expect(reads['find (missing)']).toBeUndefined()
    expect((reads.all as any[]).map(member => member.name)).toEqual(['Ada', 'Grace', 'Linus'])
    expect(reads.count).toBe(3)
    expect(reads['where().count()']).toBe(2)
    expect(reads['where().exists()']).toBe(true)
    // The canonical pagination envelope, built without waiting.
    expect((reads.paginate as any).data.map((member: any) => member.name)).toEqual(['Ada', 'Grace'])
    expect((reads.paginate as any).total).toBe(3)
    expect((reads['where().paginate()'] as any).per_page).toBe(2)
  })

  it('reads compose like values: mid-expression, in a condition, in a loop', () => {
    expect(Member.find(2).email.split('@')[1]).toBe('example.com')
    expect(Member.where('email', 'like', '%@nowhere').exists() ? 'some' : 'none').toBe('none')
    const names: string[] = []
    for (const member of Member.where('email', 'like', '%@example.com').orderBy('id').get())
      names.push(member.name)
    expect(names).toEqual(['Ada', 'Grace'])
  })

  it('a missing row throws where the call stands', () => {
    expect(() => Member.findOrFail(987654)).toThrow('not found')
  })

  it('await keeps working on all of it', async () => {
    expect((await Member.find(1)).name).toBe('Ada')
    expect(await Member.count()).toBe(3)
    expect((await Member.where('id', '>', 1).get()).length).toBe(2)
  })

  it('an encrypted column is decrypted in place, on a model read and on a query read', () => {
    const direct = Vault.find(1)
    expect(isPromise(direct)).toBe(false)
    expect(direct.secret).toBe('sk_live_123')

    const queried = Vault.where('label', 'stripe').first()
    expect(isPromise(queried)).toBe(false)
    expect(queried.secret).toBe('sk_live_123')

    const all = Vault.where('id', '>', 0).orderBy('id').get()
    expect(isPromise(all)).toBe(false)
    expect(all.map((row: any) => row.secret)).toEqual(['sk_live_123', null])
  })

  it('a write answers in place too, on a model with nothing to wait for', () => {
    const created = Member.create({ email: 'new@example.com', name: 'New' })
    expect(isPromise(created)).toBe(false)
    expect(created.name).toBe('New')
    expect(created.id).toBeGreaterThan(3)
    expect(Member.where('email', 'new@example.com').exists()).toBe(true)

    const updated = created.update({ name: 'Renamed' })
    expect(isPromise(updated)).toBe(false)
    expect(Member.find(created.id).name).toBe('Renamed')

    created.name = 'Saved'
    expect(isPromise(created.save())).toBe(false)
    expect(Member.find(created.id).name).toBe('Saved')

    expect(Member.update(created.id, { name: 'Static' }).name).toBe('Static')
    expect(Member.where('id', created.id).update({ name: 'Bulk' })).toBe(1)
    expect(Member.firstOrCreate({ email: 'ada@example.com' }, { name: 'Other' }).name).toBe('Ada')
    expect(Member.updateOrCreate({ email: 'new@example.com' }, { name: 'Again' }).name).toBe('Again')
    const many = Member.createMany([{ email: 'a@x.io', name: 'A' }, { email: 'b@x.io', name: 'B' }])
    expect(many.map((row: any) => row.name)).toEqual(['A', 'B'])
    expect(Member.where('email', 'like', '%@x.io').delete()).toBe(2)
    expect(created.delete()).toBe(true)
    expect(Member.delete(987654)).toBe(false)
    expect(Member.count()).toBe(3)
  })

  it('a failed write throws where the call stands', () => {
    // `role` is not fillable: the mass-assignment rule refuses it before anything is written.
    expect(() => Member.create({ email: 'x@example.com', role: 'admin' })).toThrow()
    expect(Member.where('email', 'x@example.com').exists()).toBe(false)
  })

  it('a write to an encrypted column is encrypted in place and reads back decrypted', () => {
    const created = Vault.create({ label: 'github', secret: 'ghp_456' })
    expect(isPromise(created)).toBe(false)
    expect(created.secret).toBe('ghp_456')
    const stored = db.query('SELECT secret FROM rip_vaults WHERE id = ?').get(Number(created.id)) as { secret: string }
    expect(stored.secret.startsWith('enc:')).toBe(true)
    expect(Vault.find(created.id).secret).toBe('ghp_456')
    Vault.delete(created.id)
  })
})

describe('a write waits on a model that asks for work around it', () => {
  let releaseDbConfigLock: () => void
  const seen: string[] = []

  // Every one of these declares something a write has to wait for.
  const base = { table: 'rip_waiting', primaryKey: 'id', autoIncrement: true, attributes: { name: { type: 'string', fillable: true } } } as const
  const Observed = defineModel({ ...base, name: 'RipObserved', traits: { observe: true } } as const) as any
  const Searchable = defineModel({ ...base, name: 'RipSearchable', traits: { useSearch: { searchable: ['name'] } } } as const) as any
  const SoftDeleted = defineModel({ ...base, name: 'RipSoftDeleted', traits: { useSoftDeletes: true } } as const) as any
  const WithSetter = defineModel({
    ...base,
    name: 'RipWithSetter',
    set: {
      name: async (attributes: { name: string }) => {
        await Bun.sleep(1)
        seen.push('setter')
        return attributes.name.toUpperCase()
      },
    },
  } as const) as any
  const Plain = defineModel({ ...base, name: 'RipPlain' } as const) as any

  beforeAll(async () => {
    releaseDbConfigLock = await acquireDbConfigLock()
    configureOrm({ database: ':memory:' })
    getDatabase().run('CREATE TABLE rip_waiting (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, created_at TEXT, updated_at TEXT, deleted_at TEXT)')
  })

  afterAll(() => {
    releaseDbConfigLock()
  })

  it('is decided from what the model declares', () => {
    expect(modelWritesWait(Observed.getDefinition())).toBe(true)
    expect(modelWritesWait(Searchable.getDefinition())).toBe(true)
    expect(modelWritesWait(SoftDeleted.getDefinition())).toBe(true)
    expect(modelWritesWait(WithSetter.getDefinition())).toBe(true)
    expect(modelWritesWait(Plain.getDefinition())).toBe(false)
    expect(modelWritesWait({ traits: { observe: false, useSearch: undefined } })).toBe(false)
    expect(modelWritesWait({ hooks: { afterCreate() {} } })).toBe(true)
  })

  it('every write on such a model is a promise, and its reads are still values', async () => {
    for (const Model of [Observed, Searchable, SoftDeleted, WithSetter]) {
      const pending = Model.create({ name: 'row' })
      expect(isPromise(pending), `${Model.getDefinition().name}.create`).toBe(true)
      const created = await pending
      expect(isPromise(Model.find(created.id)), `${Model.getDefinition().name}.find`).toBe(false)
      // An instance write on a model with an async setter goes through
      // `updateAsync`, which is what waits for the setter.
      const instanceWrite = Model === WithSetter ? created.updateAsync({ name: 'again' }) : created.update({ name: 'again' })
      expect(isPromise(instanceWrite), `${Model.getDefinition().name} instance update`).toBe(true)
      await instanceWrite
      const staticWrite = Model.update(created.id, { name: 'static' })
      expect(isPromise(staticWrite), `${Model.getDefinition().name}.update`).toBe(true)
      await staticWrite
      const queryDelete = Model.where('id', created.id).delete()
      expect(isPromise(queryDelete), `${Model.getDefinition().name} query delete`).toBe(true)
      await queryDelete
    }
  })

  it('waits for an async setter before the row is written', async () => {
    seen.length = 0
    const created = await WithSetter.create({ name: 'quiet' })
    expect(seen).toEqual(['setter'])
    expect(created.name).toBe('QUIET')
  })

  it('a failure on such a model is a rejection, never thrown in place', async () => {
    const pending = Observed.create({ name: 'x', nope: true })
    expect(isPromise(pending)).toBe(true)
    await expect(pending).rejects.toThrow()
  })

  it('the model with none of that writes in place, on the same table', () => {
    const created = Plain.create({ name: 'plain' })
    expect(isPromise(created)).toBe(false)
    expect(created.name).toBe('plain')
  })
})
