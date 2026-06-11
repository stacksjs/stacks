import { afterAll, beforeEach, describe, expect, it, mock } from 'bun:test'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// The shared test-database helper was authored against kysely
// (`sql\`...\`.execute(db)`) and a module-level driver snapshot
// (`const driver = database.default || ''`). Both rotted: the current
// bun-query-builder sql template has no `.execute`, so every mysql/raw
// path threw a TypeError, and the module-level snapshot raced the async
// config-override loader so the helper froze whatever driver happened
// to be merged at import time. These tests pin the ported behavior:
//   - driver resolved per call off the live `config` proxy
//   - raw SQL issued through `db.unsafe(...).execute()`
//   - `truncateSqliteFast` checkpoints the WAL before snapshotting
//     (copyFileSync alone captured empty/partial schemas in WAL mode)

const executed: string[] = []
const calls: string[] = []

const tempDir = mkdtempSync(join(tmpdir(), 'stacks-testing-driver-'))
const sqliteFile = join(tempDir, 'test.sqlite')
writeFileSync(sqliteFile, 'stub-db-bytes')

// Flipped between tests to prove call-time driver resolution.
let driver = 'mysql'

// `mock.module` is process-wide and bun does NOT restore it between
// test files (same hazard documented in auth/tests/register.test.ts),
// so capture the real namespaces BEFORE mocking and put them back in
// afterAll. The spread matters: mocking patches the live namespace in
// place, so a bare capture would "restore" the mock itself.
const realDatabase = { ...await import('@stacksjs/database') }
const realConfig = { ...await import('@stacksjs/config') }

mock.module('@stacksjs/database', () => ({
  ...realDatabase,
  db: {
    unsafe: (statement: string) => ({
      execute: async () => { executed.push(statement) },
    }),
  },
  fetchSqliteFile: () => sqliteFile,
  fetchTables: async () => ['orders', 'users'],
  copyModelFiles: async () => { calls.push('copyModelFiles') },
  deleteFrameworkModels: async () => { calls.push('deleteFrameworkModels') },
  dropSqliteTables: async () => { calls.push('dropSqliteTables') },
  migrateAuthTables: async () => ({ success: true }),
  migrateNotificationTables: async () => ({ success: true }),
  migrateRbacTables: async () => ({ success: true }),
  runDatabaseMigration: async () => {
    calls.push('runDatabaseMigration')
    return { isOk: true }
  },
}))

mock.module('@stacksjs/config', () => ({
  ...realConfig,
  config: new Proxy({}, {
    get(_target, prop: string) {
      if (prop === 'database')
        return { default: driver, connections: { mysql: { name: 'stacks' } } }
      return (realConfig.config as any)[prop]
    },
  }),
}))

afterAll(() => {
  mock.module('@stacksjs/database', () => realDatabase)
  mock.module('@stacksjs/config', () => realConfig)
  rmSync(tempDir, { recursive: true, force: true })
})

beforeEach(() => {
  executed.length = 0
  calls.length = 0
})

describe('test-database helper drives the current query-builder API', () => {
  it('setupDatabase (mysql) issues CREATE DATABASE through db.unsafe', async () => {
    driver = 'mysql'
    const { setupDatabase } = await import('../src/database')
    await setupDatabase()

    expect(executed).toContain('CREATE DATABASE IF NOT EXISTS stacks_testing')
    expect(calls).toContain('runDatabaseMigration')
  })

  it('resolves the driver at call time, not module load', async () => {
    const { refreshDatabase } = await import('../src/database')

    // Unknown driver: the refresh must be a no-op.
    driver = ''
    await refreshDatabase()
    expect(executed).toEqual([])

    // Same module instance, flipped driver: the mysql path must now
    // run. The old module-level snapshot kept the import-time driver
    // forever, so this flip had no effect.
    driver = 'mysql'
    await refreshDatabase()
    expect(executed).toContain('SET FOREIGN_KEY_CHECKS = 0')
    expect(executed).toContain('TRUNCATE TABLE orders')
  })

  it('truncateMysql wraps TRUNCATEs in FK-check toggles via db.unsafe', async () => {
    const { truncateMysql } = await import('../src/database')
    await truncateMysql()

    expect(executed).toEqual([
      'SET FOREIGN_KEY_CHECKS = 0',
      'TRUNCATE TABLE orders',
      'TRUNCATE TABLE users',
      'SET FOREIGN_KEY_CHECKS = 1',
    ])
  })

  it('useTransactionalTests drives savepoints via db.unsafe', async () => {
    const { useTransactionalTests } = await import('../src/database')
    const tx = useTransactionalTests()
    await tx.begin()
    await tx.rollback()

    expect(executed).toHaveLength(3)
    expect(executed[0]).toStartWith('SAVEPOINT ')
    const savepoint = executed[0].slice('SAVEPOINT '.length)
    expect(executed[1]).toBe(`ROLLBACK TO SAVEPOINT ${savepoint}`)
    expect(executed[2]).toBe(`RELEASE SAVEPOINT ${savepoint}`)
  })

  it('truncateSqliteFast checkpoints the WAL before snapshotting', async () => {
    driver = 'sqlite'
    const { truncateSqliteFast } = await import('../src/database')
    await truncateSqliteFast()

    // Without the checkpoint, copyFileSync snapshots only the main DB
    // file and any un-checkpointed schema in the -wal sidecar is lost.
    expect(executed).toContain('PRAGMA wal_checkpoint(TRUNCATE)')
    expect(existsSync(`${sqliteFile}.snapshot`)).toBe(true)
  })
})
