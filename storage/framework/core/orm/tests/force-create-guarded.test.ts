/**
 * `Model.forceCreate()` must actually persist `guarded` columns.
 *
 * Bypassing this layer's mass-assignment wrapper was not enough on its own:
 * the query builder's `create()` fills through `fill()`, which only accepts
 * `fillable && !guarded` attributes, so a guarded column never reached the
 * INSERT. A guarded NOT NULL column threw a constraint error and a nullable
 * one silently wrote NULL.
 *
 * That broke the exact use case guarding exists for: a column holding an API
 * key or an idempotency key is marked guarded so a request body cannot set
 * it, then written deliberately through the escape hatch.
 *
 * The pre-existing coverage in mass-assignment.test.ts only asserted that
 * `forceCreate` does not throw a MassAssignmentException, which is why this
 * went unnoticed. These tests read the row back.
 */
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { Database } from 'bun:sqlite'
import { configureOrm, getDatabase } from 'bun-query-builder'
import { acquireDbConfigLock } from '@stacksjs/database'
import { defineModel } from '../src/define-model'

describe('forceCreate persists guarded columns', () => {
  let db: Database
  let releaseDbConfigLock: () => void

  beforeAll(async () => {
    releaseDbConfigLock = await acquireDbConfigLock()
    configureOrm({ database: ':memory:' })
    db = getDatabase()
    db.run(`CREATE TABLE fc_credentials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      api_key TEXT NOT NULL,
      note TEXT
    )`)
  })

  afterAll(() => {
    releaseDbConfigLock()
  })

  const Credential = defineModel({
    name: 'FcCredential',
    table: 'fc_credentials',
    primaryKey: 'id',
    autoIncrement: true,
    attributes: {
      name: { type: 'string', fillable: true },
      // NOT NULL and guarded: the combination that used to throw.
      apiKey: { type: 'string', guarded: true },
      // Nullable and guarded: the combination that used to lose data silently.
      note: { type: 'string', guarded: true },
    },
  } as const)

  it('writes a guarded NOT NULL column instead of throwing', async () => {
    const created = await (Credential as any).forceCreate({
      name: 'yelp', apiKey: 'secret-key', note: 'set deliberately',
    })

    const row = db.query('SELECT name, api_key, note FROM fc_credentials WHERE id = ?').get(Number(created.id)) as any
    expect(row).toEqual({ name: 'yelp', api_key: 'secret-key', note: 'set deliberately' })
  })

  it('returns a row carrying the guarded values', async () => {
    const created = await (Credential as any).forceCreate({ name: 'google', apiKey: 'another-key' })
    expect(Number(created.id)).toBeGreaterThan(0)

    const found = await (Credential as any).where('id', Number(created.id)).first()
    expect(found?.apiKey ?? found?.api_key).toBe('another-key')
  })

  it('still refuses guarded columns through ordinary create()', async () => {
    // The escape hatch opening does not open the front door.
    let thrown: unknown = null
    try { await (Credential as any).create({ name: 'nope', apiKey: 'leaked' }) }
    catch (error) { thrown = error }
    expect(thrown).not.toBeNull()
    expect(String((thrown as Error).message)).toContain('guarded')
  })
})

/**
 * The mass-assignment escape hatch must not double as an encryption escape
 * hatch. A guarded + encrypted column is exactly what a provider secret looks
 * like, and it is written through forceCreate/forceUpdate by definition.
 */
describe('force writes still encrypt encrypted columns', () => {
  let db: Database
  let releaseDbConfigLock: () => void
  let previousAppKey: string | undefined

  beforeAll(async () => {
    // Without a key the encrypt helpers deliberately pass values through in
    // plaintext, which would make these assertions vacuous.
    previousAppKey = process.env.APP_KEY
    process.env.APP_KEY = 'base64:0PMErlN4S1yWJn6qk8Zx3vQwRt7YbGh2Kd5FaCsXuLo='

    releaseDbConfigLock = await acquireDbConfigLock()
    configureOrm({ database: ':memory:' })
    db = getDatabase()
    db.run(`CREATE TABLE fc_secrets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label TEXT,
      token TEXT NOT NULL
    )`)
  })

  afterAll(() => {
    releaseDbConfigLock()
    if (previousAppKey === undefined) delete process.env.APP_KEY
    else process.env.APP_KEY = previousAppKey
  })

  const Secret = defineModel({
    name: 'FcSecret',
    table: 'fc_secrets',
    primaryKey: 'id',
    autoIncrement: true,
    attributes: {
      label: { type: 'string', fillable: true },
      token: { type: 'string', guarded: true, encrypted: true },
    },
  } as const)

  it('stores ciphertext at rest and returns plaintext on read', async () => {
    const created = await (Secret as any).forceCreate({ label: 'yelp', token: 'super-secret' })

    const raw = db.query('SELECT token FROM fc_secrets WHERE id = ?').get(Number(created.id)) as any
    expect(raw.token).not.toBe('super-secret')
    expect(String(raw.token).length).toBeGreaterThan('super-secret'.length)

    // Both read paths must decrypt: the direct helper and the query chain
    // callers actually use when looking a row up by something other than id.
    expect((await (Secret as any).find(Number(created.id)))?.token).toBe('super-secret')
    expect((await (Secret as any).where('id', Number(created.id)).first())?.token).toBe('super-secret')
    expect((await (Secret as any).where('label', 'yelp').first())?.token).toBe('super-secret')
  })

  it('encrypts on forceUpdate too', async () => {
    const created = await (Secret as any).forceCreate({ label: 'rotate', token: 'first-value' })
    await (Secret as any).forceUpdate(Number(created.id), { token: 'rotated-value' })

    const raw = db.query('SELECT token FROM fc_secrets WHERE id = ?').get(Number(created.id)) as any
    expect(raw.token).not.toBe('rotated-value')

    const read = await (Secret as any).where('id', Number(created.id)).first()
    expect(read?.token).toBe('rotated-value')
  })
})
