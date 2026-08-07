// stacksjs/stacks#1951 — SQLite connection bootstrap pragmas.
//
// `PRAGMA foreign_keys` is per-connection and never persists in the
// database file, so unless `getDb()` applies it on every fresh instance,
// the inline `REFERENCES … ON DELETE CASCADE` constraints emitted by
// migrations (#1916) are parsed but silently ignored. These tests go
// through the real `db` proxy to prove the pragmas are live on the
// connection the framework actually hands out.

// Must be set before the db module is imported — the @stacksjs/env proxy
// reads process.env lazily, and `getDb()` snapshots the connection config
// on first access. Restored in afterAll so the override can't leak into
// modules that sibling test files load later in the same process (e.g.
// migrations.ts snapshots DB_DATABASE_PATH at module init).
const originalDbConnection = process.env.DB_CONNECTION
const originalDbDatabasePath = process.env.DB_DATABASE_PATH
process.env.DB_CONNECTION = 'sqlite'
process.env.DB_DATABASE_PATH = ':memory:'

import { afterAll, beforeAll, describe, expect, it } from 'bun:test'

// Holds `initializeDbConfig`'s process-wide config mutex for this file's
// entire lifetime (stacksjs/stacks#1862) — acquired first thing below in
// `beforeAll`, released last thing here so a sibling test file's own
// `initializeDbConfig` call can't repoint our connection mid-run.
let releaseDbConfigLock: () => void

afterAll(() => {
  if (originalDbConnection === undefined) delete process.env.DB_CONNECTION
  else process.env.DB_CONNECTION = originalDbConnection
  if (originalDbDatabasePath === undefined) delete process.env.DB_DATABASE_PATH
  else process.env.DB_DATABASE_PATH = originalDbDatabasePath
  releaseDbConfigLock?.()
})

const { acquireDbConfigLock, applySqlitePragmas, db, ensureDatabaseConfigLoaded, initializeDbConfig, SQLITE_BOOTSTRAP_PRAGMAS } = await import('../src/utils')
const { resetConnection } = await import('@stacksjs/query-builder')

beforeAll(async () => {
  releaseDbConfigLock = await acquireDbConfigLock()

  // The background config reload nulls `_dbInstance`; settle it first so
  // the in-memory connection isn't swapped out mid-test. Then force the
  // driver back to sqlite — the loaded project config (or a sibling test
  // file in the same process) may have flipped the process-wide dialect
  // to mysql/postgres, and `getDb()` snapshots it on first access.
  await ensureDatabaseConfigLoaded()

  // Discard bun-query-builder's cached connection before this file
  // establishes its own (stacksjs/stacks#2262).
  //
  // `initializeDbConfig` nulls the framework's `_dbInstance`, so `getDb()`
  // builds a fresh query builder — but the builder captures its connection
  // from bun-query-builder's signature-keyed singleton, which is NOT reset by
  // that. On CI (bun 1.3.14) a sibling test file in the same process leaves
  // that cached connection CLOSED, and every query in this file then died with
  // `RangeError: Cannot use a closed database` at `prepare()` — the four
  // failures that keep the `test` job red, and which look exactly like #1951
  // having regressed.
  //
  // Ordered before `initializeDbConfig` so the config change is what triggers
  // the rebuild, against a cache that no longer holds a dead handle.
  resetConnection?.()

  initializeDbConfig({
    database: {
      default: 'sqlite',
      connections: { sqlite: { database: ':memory:' } },
    },
  })
})

describe('sqlite bootstrap pragmas (stacksjs/stacks#1951)', () => {
  it('exports the bootstrap pragma list with FK enforcement', () => {
    expect(typeof applySqlitePragmas).toBe('function')
    expect(SQLITE_BOOTSTRAP_PRAGMAS).toContain('PRAGMA foreign_keys = ON')
    expect(SQLITE_BOOTSTRAP_PRAGMAS).toContain('PRAGMA busy_timeout = 5000')
  })

  it('enables foreign_keys on the live connection', async () => {
    const rows = await db.unsafe('PRAGMA foreign_keys').execute()
    expect(rows).toEqual([{ foreign_keys: 1 }])
  })

  it('sets busy_timeout on the live connection', async () => {
    const rows = await db.unsafe('PRAGMA busy_timeout').execute()
    expect(rows).toEqual([{ timeout: 5000 }])
  })

  it('rejects orphan inserts against declared FK constraints', async () => {
    await db.unsafe('CREATE TABLE p_1951 (id INTEGER PRIMARY KEY)').execute()
    await db.unsafe('CREATE TABLE c_1951 (id INTEGER PRIMARY KEY, p_id INTEGER REFERENCES p_1951(id) ON DELETE CASCADE)').execute()

    // Pre-#1951 this insert succeeded silently — the core regression.
    await expect(
      db.unsafe('INSERT INTO c_1951 (id, p_id) VALUES (1, 999)').execute(),
    ).rejects.toThrow(/FOREIGN KEY constraint failed/)
  })

  it('cascades deletes through ON DELETE CASCADE', async () => {
    await db.unsafe('INSERT INTO p_1951 (id) VALUES (1)').execute()
    await db.unsafe('INSERT INTO c_1951 (id, p_id) VALUES (2, 1)').execute()
    await db.unsafe('DELETE FROM p_1951 WHERE id = 1').execute()

    const rows = await db.unsafe('SELECT COUNT(*) AS count FROM c_1951').execute()
    expect(rows[0].count).toBe(0)
  })
})

/**
 * The same property, on a connection this file owns outright
 * (stacksjs/stacks#2262).
 *
 * Everything above goes through the shared `db` proxy, which is the right
 * thing to assert — it is the connection the framework actually hands out.
 * It is also the thing that broke: on CI a sibling test file left
 * bun-query-builder's cached connection closed, and all four of #1951's
 * regression tests failed for a reason that had nothing to do with #1951.
 * A guard that reports a regression it did not observe is worse than no
 * guard, because the next person spends their time on the wrong bug.
 *
 * So the pragma list's actual effect is also proven here against a
 * `bun:sqlite` handle opened and closed by this block alone. No shared
 * state, no cache, no ordering dependency — if `SQLITE_BOOTSTRAP_PRAGMAS`
 * ever stops enforcing foreign keys, this fails on every machine.
 */
describe('the bootstrap pragmas enforce FKs on any connection (#1951, #2262)', () => {
  let owned: InstanceType<typeof import('bun:sqlite').Database>

  beforeAll(async () => {
    const { Database } = await import('bun:sqlite')
    owned = new Database(':memory:')
    for (const pragma of SQLITE_BOOTSTRAP_PRAGMAS)
      owned.run(pragma)
  })

  afterAll(() => {
    owned?.close()
  })

  it('turns foreign_keys on', () => {
    expect(owned.query('PRAGMA foreign_keys').get()).toEqual({ foreign_keys: 1 })
  })

  it('sets busy_timeout', () => {
    expect(owned.query('PRAGMA busy_timeout').get()).toEqual({ timeout: 5000 })
  })

  it('rejects an orphan insert', () => {
    owned.run('CREATE TABLE p_owned (id INTEGER PRIMARY KEY)')
    owned.run('CREATE TABLE c_owned (id INTEGER PRIMARY KEY, p_id INTEGER REFERENCES p_owned(id) ON DELETE CASCADE)')

    // Pre-#1951 this succeeded silently — the core regression.
    expect(() => owned.run('INSERT INTO c_owned (id, p_id) VALUES (1, 999)'))
      .toThrow(/FOREIGN KEY constraint failed/)
  })

  it('cascades a delete', () => {
    owned.run('INSERT INTO p_owned (id) VALUES (1)')
    owned.run('INSERT INTO c_owned (id, p_id) VALUES (2, 1)')
    owned.run('DELETE FROM p_owned WHERE id = 1')

    expect(owned.query('SELECT COUNT(*) AS count FROM c_owned').get()).toEqual({ count: 0 })
  })

  it('the list is not vacuous', () => {
    // Without this, the four above would still pass if the constant were
    // emptied — sqlite's default is FKs OFF, so the orphan insert would
    // succeed and `toThrow` would be the only failure. Cheap insurance that
    // the constant is what is being exercised.
    expect(SQLITE_BOOTSTRAP_PRAGMAS.length).toBeGreaterThanOrEqual(3)
    expect(SQLITE_BOOTSTRAP_PRAGMAS).toContain('PRAGMA foreign_keys = ON')
  })
})
