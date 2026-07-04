// stacksjs/stacks#1951 follow-up — SQLite bootstrap pragmas on EVERY
// framework-created query-builder instance.
//
// The wave-1 fix pragma'd only the `db` proxy in @stacksjs/database, but the
// ORM auto-CRUD route files (storage/framework/orm/routes.ts and
// core/orm/routes.ts) bootstrap their own builder — `setConfig(...)` then
// `createQueryBuilder()` — capturing a connection whose upstream constructor
// only sets `journal_mode = WAL`. These tests replicate that exact bootstrap
// against the wrapped `createQueryBuilder` and drive the same chain API the
// auto-CRUD handlers use (`insertInto().values()`, `deleteFrom().where()`),
// proving the write path runs with `foreign_keys = ON`. Pre-fix, the orphan
// insert below succeeded silently and the cascade never fired.
import { afterAll, describe, expect, it } from 'bun:test'
import { config, configureOrm, createModel, createQueryBuilder, getDatabase, setConfig, SQLITE_BOOTSTRAP_PRAGMAS } from '../src/index'

// Config is process-wide; snapshot what sibling test files may have set and
// restore it after, so this file can't leak its in-memory sqlite override.
const originalDialect = config.dialect
const originalDatabase = { ...config.database }

afterAll(() => {
  setConfig({ dialect: originalDialect, database: originalDatabase } as any)
})

// Mirrors the auto-CRUD route bootstrap (storage/framework/orm/routes.ts:17,68).
setConfig({ dialect: 'sqlite', database: { database: ':memory:' } } as any)
const db = createQueryBuilder() as any

describe('wrapped createQueryBuilder sqlite pragmas (stacksjs/stacks#1951)', () => {
  it('exports the bootstrap pragma list with FK enforcement', () => {
    expect(SQLITE_BOOTSTRAP_PRAGMAS).toContain('PRAGMA foreign_keys = ON')
    expect(SQLITE_BOOTSTRAP_PRAGMAS).toContain('PRAGMA busy_timeout = 5000')
  })

  it('enables foreign_keys on a self-bootstrapped builder connection', async () => {
    const rows = await db.unsafe('PRAGMA foreign_keys').execute()
    expect(rows).toEqual([{ foreign_keys: 1 }])
  })

  it('sets busy_timeout on a self-bootstrapped builder connection', async () => {
    const rows = await db.unsafe('PRAGMA busy_timeout').execute()
    expect(rows).toEqual([{ timeout: 5000 }])
  })

  it('rejects orphan inserts through the auto-CRUD write chain', async () => {
    await db.unsafe('CREATE TABLE p_1951qb (id INTEGER PRIMARY KEY)').execute()
    await db.unsafe('CREATE TABLE c_1951qb (id INTEGER PRIMARY KEY, p_id INTEGER REFERENCES p_1951qb(id) ON DELETE CASCADE)').execute()

    // The exact store-handler path: insertInto(table).values(data).execute().
    // Pre-fix this orphan insert succeeded silently — FK enforcement was off.
    await expect(
      db.insertInto('c_1951qb').values({ id: 1, p_id: 999 }).execute(),
    ).rejects.toThrow(/FOREIGN KEY constraint failed/)
  })

  it('cascades deletes through the auto-CRUD destroy chain', async () => {
    await db.unsafe('INSERT INTO p_1951qb (id) VALUES (1)').execute()
    await db.insertInto('c_1951qb').values({ id: 2, p_id: 1 }).execute()

    // The exact destroy-handler path: deleteFrom(table).where({ id }).execute().
    await db.deleteFrom('p_1951qb').where({ id: 1 }).execute()

    const rows = await db.unsafe('SELECT COUNT(*) AS count FROM c_1951qb').execute()
    expect(rows[0].count).toBe(0)
  })
})

// The MODEL-EXECUTOR connection — bun-query-builder's second, independent
// sqlite layer. `configureOrm`/`getExecutor` build a raw `bun:sqlite`
// `Database` (no pragmas at all) and every `Model.create()/save()/delete()`
// writes through it, NOT through the query-builder connection above.
// Pre-fix this left the production ORM write path with `foreign_keys = OFF`
// and default WAL checkpointing while the (idle) query-builder connection
// was correctly bootstrapped — confirmed on a live deploy via lsof showing
// two db connections and ORM-inserted WAL frames never auto-checkpointing.
describe('model-executor sqlite pragmas (ORM writer connection)', () => {
  it('bootstraps the raw Database that configureOrm creates — the exact @stacksjs/orm autoConfigureOrm path', () => {
    configureOrm({ database: ':memory:' })
    const raw = getDatabase() as any
    expect(raw.query('PRAGMA foreign_keys').get()).toEqual({ foreign_keys: 1 })
    expect(raw.query('PRAGMA wal_autocheckpoint').get()).toEqual({ wal_autocheckpoint: 1 })
    expect(raw.query('PRAGMA busy_timeout').get()).toEqual({ timeout: 5000 })
  })

  it('re-bootstraps when configureOrm swaps in a fresh executor Database', () => {
    // A second configure replaces the executor's Database (new object) —
    // the WeakSet guard must not suppress bootstrapping the new handle.
    configureOrm({ database: ':memory:' })
    const raw = getDatabase() as any
    expect(raw.query('PRAGMA foreign_keys').get()).toEqual({ foreign_keys: 1 })
  })

  it('enforces FKs on the real model write path (Model.create → getExecutor)', async () => {
    configureOrm({ database: ':memory:' })
    const raw = getDatabase() as any
    raw.run('CREATE TABLE p_exec (id INTEGER PRIMARY KEY)')
    raw.run('CREATE TABLE c_exec (id INTEGER PRIMARY KEY, p_id INTEGER REFERENCES p_exec(id) ON DELETE CASCADE)')

    const Child = createModel({
      name: 'CExec',
      table: 'c_exec',
      primaryKey: 'id',
      attributes: {
        p_id: { fillable: true },
      },
    } as any) as any

    // No explicit `id`: ModelInstance.save() treats a set primary key as
    // "row exists" and takes its UPDATE branch (a no-op here) — only the
    // autoincrement path exercises the INSERT the contact form and every
    // other Model.create() call actually performs.
    //
    // Pre-fix this orphan insert succeeded silently — the executor's raw
    // Database had FK enforcement off no matter what the query-builder
    // connection was bootstrapped with.
    await expect(Child.create({ p_id: 999 })).rejects.toThrow(/FOREIGN KEY constraint failed/)

    // And a valid child still inserts fine through the same path.
    raw.run('INSERT INTO p_exec (id) VALUES (1)')
    await Child.create({ p_id: 1 })
    expect(raw.query('SELECT COUNT(*) AS count FROM c_exec').get()).toEqual({ count: 1 })
  })

  it('re-asserts executor pragmas from the wrapped createQueryBuilder (config-reload path)', () => {
    // Framework entry points call createQueryBuilder on boot/config reloads;
    // it must (idempotently) cover the executor connection too, so a lazily
    // recreated executor is never left unbootstrapped.
    configureOrm({ database: ':memory:' })
    createQueryBuilder()
    const raw = getDatabase() as any
    expect(raw.query('PRAGMA foreign_keys').get()).toEqual({ foreign_keys: 1 })
    expect(raw.query('PRAGMA wal_autocheckpoint').get()).toEqual({ wal_autocheckpoint: 1 })
  })
})
