// stacksjs/stacks#1951 — FK orphan detection tests.
//
// Pin DB_CONNECTION/DB_DATABASE_PATH before importing src/utils (lazy
// env proxy + getDb() config snapshot), restore in afterAll so the
// override can't leak into sibling test files (process-wide setConfig,
// stacksjs/stacks#1862).

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

const { acquireDbConfigLock, db, ensureDatabaseConfigLoaded, initializeDbConfig } = await import('../src/utils')
const { findFkOrphans } = await import('../src/fk-audit')

beforeAll(async () => {
  releaseDbConfigLock = await acquireDbConfigLock()
  await ensureDatabaseConfigLoaded()
  initializeDbConfig({
    database: {
      default: 'sqlite',
      connections: { sqlite: { database: ':memory:' } },
    },
  })

  await db.unsafe('CREATE TABLE fko_users (id INTEGER PRIMARY KEY)').execute()
  await db.unsafe('CREATE TABLE fko_posts (id INTEGER PRIMARY KEY, user_id INTEGER REFERENCES fko_users(id) ON DELETE CASCADE)').execute()

  // Simulate the exact #1951 legacy state: insert an orphan while FK
  // enforcement is OFF, then re-enable. foreign_key_check works
  // regardless of the pragma state.
  await db.unsafe('PRAGMA foreign_keys = OFF').execute()
  await db.unsafe('INSERT INTO fko_users (id) VALUES (1)').execute()
  await db.unsafe('INSERT INTO fko_posts (id, user_id) VALUES (1, 1)').execute() // valid
  await db.unsafe('INSERT INTO fko_posts (id, user_id) VALUES (2, 999)').execute() // orphan
  await db.unsafe('INSERT INTO fko_posts (id, user_id) VALUES (3, NULL)').execute() // NULL FK — not an orphan
  await db.unsafe('PRAGMA foreign_keys = ON').execute()
})

describe('findFkOrphans (stacksjs/stacks#1951)', () => {
  it('reports orphan rows but excludes valid and NULL-FK rows', async () => {
    const result = await findFkOrphans('sqlite')
    expect(result.supported).toBe(true)
    expect(result.total).toBe(1)

    const orphan = result.orphans.find(o => o.table === 'fko_posts' && o.parent === 'fko_users')
    expect(orphan).toBeDefined()
    expect(orphan!.column).toBe('user_id')
    expect(orphan!.count).toBe(1)
    expect(orphan!.sampleRowids).toContain(2)
  })

  it('degrades to supported:false on non-sqlite dialects', async () => {
    const result = await findFkOrphans('mysql')
    expect(result.supported).toBe(false)
    expect(result.total).toBe(0)
    expect(result.orphans).toEqual([])
  })
})
