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

beforeAll(async () => {
  releaseDbConfigLock = await acquireDbConfigLock()

  // The background config reload nulls `_dbInstance`; settle it first so
  // the in-memory connection isn't swapped out mid-test. Then force the
  // driver back to sqlite — the loaded project config (or a sibling test
  // file in the same process) may have flipped the process-wide dialect
  // to mysql/postgres, and `getDb()` snapshots it on first access.
  await ensureDatabaseConfigLoaded()
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
