// stacksjs/stacks#1953 — SQLite transaction serialization.
//
// Bun.SQL's sqlite adapter is a single shared connection, so two
// CONCURRENT `db.transaction()` calls used to interleave at BEGIN: the
// loser failed with "cannot start a transaction within a transaction"
// or "no such savepoint: qb_sp_N" — a 500 on perfectly legal work (two
// near-simultaneous registrations for different emails). `getDb()` now
// queues transactions through a promise-chain mutex on the sqlite
// dialect. These tests drive the real `db` proxy to pin that behavior.

// Must be set before the db module is imported — the @stacksjs/env proxy
// reads process.env lazily, and `getDb()` snapshots the connection config
// on first access. Restored in afterAll so the override can't leak into
// modules that sibling test files load later in the same process.
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

beforeAll(async () => {
  releaseDbConfigLock = await acquireDbConfigLock()

  // Settle the background config reload, then force the dialect back to
  // sqlite — a sibling test file may have flipped the process-wide config.
  await ensureDatabaseConfigLoaded()
  initializeDbConfig({
    database: {
      default: 'sqlite',
      connections: { sqlite: { database: ':memory:' } },
    },
  })

  await db.unsafe(`
    CREATE TABLE IF NOT EXISTS accounts_1953 (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email VARCHAR(255) NOT NULL
    )
  `).execute()
  await db.unsafe('CREATE UNIQUE INDEX IF NOT EXISTS accounts_1953_email_unique ON accounts_1953 (email)').execute()
})

// Register-shaped transaction: check + insert + read-back, each statement
// awaited so the event loop can interleave concurrent callers — the exact
// shape of `register()` / `resetPassword()` that collided pre-fix.
async function registerShaped(email: string): Promise<number> {
  return await db.transaction(async (rawTrx: any) => {
    const existing = await rawTrx.selectFrom('accounts_1953').where('email', '=', email).selectAll().executeTakeFirst()
    if (existing)
      throw new Error('email already exists')
    await rawTrx.insertInto('accounts_1953').values({ email }).execute()
    const created = await rawTrx.selectFrom('accounts_1953').where('email', '=', email).selectAll().executeTakeFirst()
    return Number(created.id)
  })
}

describe('sqlite transaction serialization (stacksjs/stacks#1953)', () => {
  it('lets concurrent different-key transactions all commit', async () => {
    // Pre-fix: 2 of 3 rejected with a BEGIN/savepoint collision even
    // though every registration was legal.
    const results = await Promise.allSettled([
      registerShaped('a-1953@example.com'),
      registerShaped('b-1953@example.com'),
      registerShaped('c-1953@example.com'),
    ])

    expect(results.map(r => r.status)).toEqual(['fulfilled', 'fulfilled', 'fulfilled'])

    const rows = await db.unsafe(`
      SELECT COUNT(*) AS count FROM accounts_1953 WHERE email LIKE '%-1953@example.com'
    `).execute()
    expect(rows[0].count).toBe(3)
  })

  it('surfaces the domain error (not a BEGIN collision) to the concurrent same-key loser', async () => {
    const results = await Promise.allSettled([
      registerShaped('same-1953@example.com'),
      registerShaped('same-1953@example.com'),
    ])

    const fulfilled = results.filter(r => r.status === 'fulfilled')
    const rejected = results.filter(r => r.status === 'rejected') as PromiseRejectedResult[]
    expect(fulfilled.length).toBe(1)
    expect(rejected.length).toBe(1)
    // Pre-fix the loser died at BEGIN ("cannot start a transaction within
    // a transaction"), so the in-transaction duplicate check never ran.
    expect((rejected[0]!.reason as Error).message).toBe('email already exists')

    const rows = await db.unsafe(`
      SELECT COUNT(*) AS count FROM accounts_1953 WHERE email = 'same-1953@example.com'
    `).execute()
    expect(rows[0].count).toBe(1)
  })

  it('releases the queue after a rolled-back transaction', async () => {
    await expect(db.transaction(async (rawTrx: any) => {
      await rawTrx.insertInto('accounts_1953').values({ email: 'rollback-1953@example.com' }).execute()
      throw new Error('force rollback')
    })).rejects.toThrow('force rollback')

    // The rollback both undid the insert and left the mutex free.
    const next = await registerShaped('after-rollback-1953@example.com')
    expect(next).toBeGreaterThan(0)

    const rows = await db.unsafe(`
      SELECT COUNT(*) AS count FROM accounts_1953 WHERE email = 'rollback-1953@example.com'
    `).execute()
    expect(rows[0].count).toBe(0)
  })

  it('does not deadlock nested top-level db.transaction calls (savepoint path)', async () => {
    // A nested `db.transaction()` inside an open transaction's callback is
    // the sequential savepoint case — it must bypass the queue, otherwise
    // the inner call waits forever on its own caller.
    const result = await db.transaction(async (rawTrx: any) => {
      await rawTrx.insertInto('accounts_1953').values({ email: 'outer-1953@example.com' }).execute()
      return await db.transaction(async (innerTrx: any) => {
        await innerTrx.insertInto('accounts_1953').values({ email: 'inner-1953@example.com' }).execute()
        return 'nested-ok'
      })
    })
    expect(result).toBe('nested-ok')

    const rows = await db.unsafe(`
      SELECT COUNT(*) AS count FROM accounts_1953 WHERE email IN ('outer-1953@example.com', 'inner-1953@example.com')
    `).execute()
    expect(rows[0].count).toBe(2)
  })

  it('serializes transactional()-wrapped functions too', async () => {
    // `transactional()` calls `this.transaction(...)` internally; the
    // instance patch (not a proxy-level wrapper) is what covers it.
    const wrapped = db.transactional(async (rawTrx: any, email: string) => {
      const existing = await rawTrx.selectFrom('accounts_1953').where('email', '=', email).selectAll().executeTakeFirst()
      if (existing)
        throw new Error('email already exists')
      await rawTrx.insertInto('accounts_1953').values({ email }).execute()
      const created = await rawTrx.selectFrom('accounts_1953').where('email', '=', email).selectAll().executeTakeFirst()
      return Number(created.id)
    })

    const results = await Promise.allSettled([
      wrapped('tx-fn-a-1953@example.com'),
      wrapped('tx-fn-b-1953@example.com'),
    ])
    expect(results.map(r => r.status)).toEqual(['fulfilled', 'fulfilled'])
  })
})
