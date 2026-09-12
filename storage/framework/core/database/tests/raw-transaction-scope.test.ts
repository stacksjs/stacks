// stacksjs/stacks#2539 — `db.transaction()` must open the after-commit scope.
//
// `runInTransactionScope` is what `isInTransaction()` and `enqueueAfterCommit()`
// read, and only `@stacksjs/orm`'s `transaction()` ever opened it. The raw
// builder's own `db.transaction()` got SQLite serialization and replica routing
// but not this, so a `job(...).dispatch()` inside its callback saw
// `isInTransaction() === false` and dispatched immediately.
//
// Not merely early: on rollback the side effect is already done. The row can
// roll back with the shared SQLite connection, but a Redis push or an HTTP call
// cannot, which is the whole reason after-commit buffering exists.
//
// transaction-context.test.ts covers the primitive in isolation and says so in
// its own header. That is exactly why this went unnoticed - the primitive was
// always correct, and no test drove it through a public entry point.

const originalDbConnection = process.env.DB_CONNECTION
const originalDbDatabasePath = process.env.DB_DATABASE_PATH
process.env.DB_CONNECTION = 'sqlite'
process.env.DB_DATABASE_PATH = ':memory:'

import { afterAll, beforeAll, describe, expect, it } from 'bun:test'

let releaseDbConfigLock: () => void

afterAll(() => {
  if (originalDbConnection === undefined) delete process.env.DB_CONNECTION
  else process.env.DB_CONNECTION = originalDbConnection
  if (originalDbDatabasePath === undefined) delete process.env.DB_DATABASE_PATH
  else process.env.DB_DATABASE_PATH = originalDbDatabasePath
  releaseDbConfigLock?.()
})

const { acquireDbConfigLock, db, ensureDatabaseConfigLoaded, initializeDbConfig } = await import('../src/utils')
const { enqueueAfterCommit, isInTransaction } = await import('../src/transaction-context')

beforeAll(async () => {
  releaseDbConfigLock = await acquireDbConfigLock()
  await ensureDatabaseConfigLoaded()
  initializeDbConfig({
    database: {
      default: 'sqlite',
      connections: { sqlite: { database: ':memory:' } },
    },
  })
})

describe('db.transaction() and the after-commit scope', () => {
  it('reports being inside a transaction', async () => {
    // Red before the fix: false, so the buffering branch in the queue's
    // dispatch was skipped entirely and it fell through to immediate.
    let inside: boolean | undefined
    await db.transaction(async () => { inside = isInTransaction() })

    expect(inside).toBe(true)
    expect(isInTransaction()).toBe(false)
  })

  it('buffers a callback until the transaction commits', async () => {
    const fired: string[] = []

    await db.transaction(async () => {
      enqueueAfterCommit(async () => { fired.push('side-effect') })
      // The assertion that matters: nothing has run yet.
      expect(fired).toEqual([])
    })

    expect(fired).toEqual(['side-effect'])
  })

  it('discards buffered callbacks when the transaction rolls back', async () => {
    // The case the row-level rollback cannot cover. A queued Redis push or an
    // outbound HTTP call does not roll back with the connection.
    const fired: string[] = []

    await expect(db.transaction(async () => {
      enqueueAfterCommit(async () => { fired.push('should-not-fire') })
      throw new Error('rollback')
    })).rejects.toThrow('rollback')

    expect(fired).toEqual([])
  })

  it('fires exactly once when the orm wrapper nests around it', async () => {
    // `@stacksjs/orm`'s `transaction()` already opens a scope and then calls
    // `db.transaction()`, which now opens one too. The scope is reentrant, so
    // the inner call only tracks depth - but a double flush here would send
    // every queued job twice.
    const { transaction } = await import('@stacksjs/orm')
    const fired: string[] = []

    await transaction(async () => {
      enqueueAfterCommit(async () => { fired.push('once') })
    })

    expect(fired).toEqual(['once'])
  })

  it('lets the outermost transaction own the flush when nested directly', async () => {
    const fired: string[] = []

    await db.transaction(async () => {
      await db.transaction(async () => {
        enqueueAfterCommit(async () => { fired.push('inner') })
      })
      // Still buffered: the inner transaction committing is not the commit
      // the callback was waiting on.
      expect(fired).toEqual([])
    })

    expect(fired).toEqual(['inner'])
  })

  it('discards a rolled-back savepoint callback when the outer transaction commits', async () => {
    await db.unsafe('CREATE TABLE scope_savepoint_probe (id INTEGER PRIMARY KEY)').execute()
    const fired: string[] = []

    await db.transaction(async (outer) => {
      await outer.unsafe('INSERT INTO scope_savepoint_probe (id) VALUES (1)').execute()
      enqueueAfterCommit(() => { fired.push('outer') })
      await expect(db.transaction(async (inner) => {
        await inner.unsafe('INSERT INTO scope_savepoint_probe (id) VALUES (2)').execute()
        enqueueAfterCommit(() => { fired.push('rolled-back-inner') })
        throw new Error('rollback savepoint only')
      })).rejects.toThrow('rollback savepoint only')
      expect(fired).toEqual([])
    })

    const rows = await db.unsafe('SELECT id FROM scope_savepoint_probe ORDER BY id').execute()
    expect(rows.map(row => row.id)).toEqual([1])
    expect(fired).toEqual(['outer'])
  })

  it.each(['transaction', 'savepoint'] as const)('tracks %s opened through the callback handle', async (method) => {
    await db.unsafe('CREATE TABLE IF NOT EXISTS scope_handle_probe (id INTEGER PRIMARY KEY)').execute()
    const fired: string[] = []
    await db.transaction(async (outer) => {
      enqueueAfterCommit(() => { fired.push('outer') })
      await expect(outer[method](async (inner) => {
        await inner.unsafe('INSERT INTO scope_handle_probe (id) VALUES (2)').execute()
        enqueueAfterCommit(() => { fired.push('rolled-back-inner') })
        throw new Error('callback handle rollback')
      })).rejects.toThrow('callback handle rollback')
    })
    expect(await db.unsafe('SELECT id FROM scope_handle_probe').execute()).toEqual([])
    expect(fired).toEqual(['outer'])
  })

  it('consumes late dispatches from an already rolled-back savepoint', async () => {
    const fired: string[] = []
    const release = Promise.withResolvers<void>()
    let lingering: Promise<boolean> | undefined
    await db.transaction(async (outer) => {
      await expect(outer.savepoint(async () => {
        lingering = release.promise.then(() => enqueueAfterCommit(() => { fired.push('late') }))
        await Promise.all([Promise.reject(new Error('rollback first')), lingering])
      })).rejects.toThrow('rollback first')
      release.resolve()
      expect(await lingering).toBe(true)
      enqueueAfterCommit(() => { fired.push('outer') })
    })
    expect(fired).toEqual(['outer'])
  })
})
