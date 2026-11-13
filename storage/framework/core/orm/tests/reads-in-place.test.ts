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
 * A write answers in place too, with its lifecycle around it: listeners are
 * heard in place, and the search index and the broadcast are brought up to
 * date after the row is back. It is a promise only on a model that declares
 * something a write has to wait for.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test'
import { Database } from 'bun:sqlite'
import process from 'node:process'
import { configureOrm, getDatabase } from 'bun-query-builder'
import { acquireDbConfigLock } from '@stacksjs/database'
import { listen, off } from '@stacksjs/events'
import { defineModel, modelWorkSettled, modelWritesWait } from '../src/define-model'
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

describe('a write waits on a model that asks for work it cannot do in place', () => {
  let releaseDbConfigLock: () => void
  const seen: string[] = []

  const base = { table: 'rip_waiting', primaryKey: 'id', autoIncrement: true, attributes: { name: { type: 'string', fillable: true } } } as const
  // Each of these declares something a write has to wait for.
  const SoftDeleted = defineModel({ ...base, name: 'RipSoftDeleted', traits: { useSoftDeletes: true } } as const) as any
  const WithAsyncSetter = defineModel({
    ...base,
    name: 'RipWithAsyncSetter',
    set: {
      name: async (attributes: { name: string }) => {
        await Bun.sleep(1)
        seen.push('setter')
        return attributes.name.toUpperCase()
      },
    },
  } as const) as any
  // And these do not: events are heard in place, the index is updated after,
  // a setter that answers in place is part of the write.
  const Observed = defineModel({ ...base, name: 'RipObserved', traits: { observe: true } } as const) as any
  const WithSetter = defineModel({ ...base, name: 'RipWithSetter', set: { name: (attributes: { name: string }) => attributes.name.trim() } } as const) as any
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
    expect(modelWritesWait(SoftDeleted.getDefinition())).toBe(true)
    expect(modelWritesWait(WithAsyncSetter.getDefinition())).toBe(true)
    expect(modelWritesWait({ traits: { useAudit: true } })).toBe(true)
    expect(modelWritesWait({ traits: { useActivityLog: true } })).toBe(true)
    expect(modelWritesWait({ hooks: { async afterCreate() {} } })).toBe(true)

    expect(modelWritesWait(Observed.getDefinition())).toBe(false)
    expect(modelWritesWait(WithSetter.getDefinition())).toBe(false)
    expect(modelWritesWait(Plain.getDefinition())).toBe(false)
    expect(modelWritesWait({ traits: { observe: true, useSearch: { searchable: ['name'] }, broadcastOn: () => 'x', useSoftDeletes: false } })).toBe(false)
    expect(modelWritesWait({ hooks: { afterCreate() {} } })).toBe(false)
  })

  it('every write on such a model is a promise, and its reads are still values', async () => {
    for (const Model of [SoftDeleted, WithAsyncSetter]) {
      const pending = Model.create({ name: 'row' })
      expect(isPromise(pending), `${Model.getDefinition().name}.create`).toBe(true)
      const created = await pending
      expect(isPromise(Model.find(created.id)), `${Model.getDefinition().name}.find`).toBe(false)
      // An instance write on a model with an async setter goes through
      // `updateAsync`, which is what waits for the setter.
      const instanceWrite = Model === WithAsyncSetter ? created.updateAsync({ name: 'again' }) : created.update({ name: 'again' })
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
    const created = await WithAsyncSetter.create({ name: 'quiet' })
    expect(seen).toEqual(['setter'])
    expect(created.name).toBe('QUIET')
  })

  it('a failure on such a model is a rejection, never thrown in place', async () => {
    const pending = SoftDeleted.create({ name: 'x', nope: true })
    expect(isPromise(pending)).toBe(true)
    await expect(pending).rejects.toThrow()
  })

  it('a setter that answers in place is part of a write in place', () => {
    const created = WithSetter.create({ name: '  padded  ' })
    expect(isPromise(created)).toBe(false)
    expect(created.name).toBe('padded')
  })

  it('the model with none of that writes in place, on the same table', () => {
    const created = Plain.create({ name: 'plain' })
    expect(isPromise(created)).toBe(false)
    expect(created.name).toBe('plain')
  })
})

describe('lifecycle work around a write that answers in place', () => {
  let releaseDbConfigLock: () => void
  const heard: string[] = []
  const subscriptions: Array<() => void> = []
  const on = (name: string, handler: (payload: any) => unknown): void => {
    const key = `ripevented:${name}` as never
    listen(key, handler as never)
    subscriptions.push(() => off(key, handler as never))
  }

  const Evented = defineModel({
    name: 'RipEvented',
    table: 'rip_evented',
    primaryKey: 'id',
    autoIncrement: true,
    traits: { observe: true },
    attributes: { name: { type: 'string', fillable: true } },
  } as const) as any

  beforeAll(async () => {
    releaseDbConfigLock = await acquireDbConfigLock()
    configureOrm({ database: ':memory:' })
    getDatabase().run('CREATE TABLE rip_evented (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, created_at TEXT, updated_at TEXT)')
  })

  afterEach(() => {
    for (const unsubscribe of subscriptions.splice(0)) unsubscribe()
    heard.length = 0
  })

  afterAll(() => {
    releaseDbConfigLock()
  })

  it('listeners that answer in place have all run by the time the row is back', () => {
    for (const name of ['saving', 'creating', 'created', 'saved'])
      on(name, () => { heard.push(name) })
    const created = Evented.create({ name: 'heard' })
    expect(isPromise(created)).toBe(false)
    expect(created.name).toBe('heard')
    expect(heard).toEqual(['saving', 'creating', 'created', 'saved'])
  })

  it('a before-listener can cancel the write in place', () => {
    on('creating', () => false)
    expect(() => Evented.create({ name: 'refused' })).toThrow('event cancelled the operation')
    expect(Evented.where('name', 'refused').exists()).toBe(false)
  })

  it('an asynchronous after-listener runs on after the row is back', async () => {
    on('created', async () => {
      await Bun.sleep(2)
      heard.push('created, later')
    })
    const created = Evented.create({ name: 'detached' })
    expect(isPromise(created)).toBe(false)
    expect(heard).toEqual([])
    await Bun.sleep(15)
    expect(heard).toEqual(['created, later'])
  })

  it('an asynchronous before-listener is still waited for, so it can still cancel', async () => {
    on('creating', async () => {
      await Bun.sleep(1)
      return false
    })
    const pending = Evented.create({ name: 'asked' })
    expect(isPromise(pending)).toBe(true)
    await expect(pending).rejects.toThrow('event cancelled the operation')
    expect(Evented.where('name', 'asked').exists()).toBe(false)
  })

  it('work started by a write is waited for by modelWorkSettled', async () => {
    const projected: string[] = []
    const Indexed = defineModel({
      name: 'RipIndexed',
      table: 'rip_evented',
      primaryKey: 'id',
      autoIncrement: true,
      traits: {
        useSearch: {
          searchable: ['name'],
          shape: async () => {
            await Bun.sleep(2)
            projected.push('projected')
            return null
          },
        },
      },
      attributes: { name: { type: 'string', fillable: true } },
    } as const) as any

    const created = Indexed.create({ name: 'indexed' })
    expect(isPromise(created)).toBe(false)
    expect(created.name).toBe('indexed')
    // The row came back first: its document has not been projected yet.
    expect(projected).toEqual([])
    await modelWorkSettled()
    expect(projected).toEqual(['projected'])
  })

  it('a failure in that work is logged, never thrown at the write, and reported by modelWorkSettled', async () => {
    const Announced = defineModel({
      name: 'RipAnnounced',
      table: 'rip_evented',
      primaryKey: 'id',
      autoIncrement: true,
      traits: {
        // Broadcasting rides on the model's events, so it needs them on.
        observe: true,
        broadcastOn: () => { throw new Error('no channel to announce on') },
        broadcastWith: () => ({}),
      },
      attributes: { name: { type: 'string', fillable: true } },
    } as const) as any

    const before = process.env.STACKS_ORM_BROADCAST_ERRORS
    const error = console.error
    process.env.STACKS_ORM_BROADCAST_ERRORS = 'throw'
    console.error = () => {}
    try {
      const created = Announced.create({ name: 'announced' })
      expect(isPromise(created)).toBe(false)
      expect(created.name).toBe('announced')
      await expect(modelWorkSettled()).rejects.toThrow('no channel to announce on')
      // Reported once: the next call has nothing left to say.
      await modelWorkSettled()
    }
    finally {
      console.error = error
      if (before === undefined) delete process.env.STACKS_ORM_BROADCAST_ERRORS
      else process.env.STACKS_ORM_BROADCAST_ERRORS = before
    }
  })
})
