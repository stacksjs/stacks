import { afterAll, describe, expect, it, mock } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// stacksjs/stacks#1948 — test databases must receive the same framework
// table guarantees as `buddy migrate`: auth/oauth tables (including the
// users.email_verified_at ALTER), notification tables, and RBAC tables.
// Pre-fix, setupDatabase/truncateSqlite ran only runDatabaseMigration(),
// so a refreshed test DB had no oauth tables and verifyEmail()'s UPDATE
// threw "no such column: email_verified_at" — and truncateSqliteFast
// snapshotted that column-less schema for every subsequent test.

const calls: string[] = []
let migrationResult: { isOk?: boolean, isErr?: boolean, error?: unknown } = { isOk: true }

const tempDir = mkdtempSync(join(tmpdir(), 'stacks-testing-db-'))
const sqliteFile = join(tempDir, 'test.sqlite')
writeFileSync(sqliteFile, '')

// `mock.module` is process-wide and bun does NOT restore it between
// test files (same hazard documented in auth/tests/register.test.ts),
// so capture the real namespace BEFORE mocking and put it back in
// afterAll. Without the restore, every test file that evaluates later
// in the same `bun test` run sees this stub — `db` without `.unsafe`,
// no `initializeDbConfig`, etc. The spread matters: mocking patches
// the live namespace in place, so a bare capture would "restore" the
// mock itself.
const realDatabase = { ...await import('@stacksjs/database') }

mock.module('@stacksjs/database', () => ({
  copyModelFiles: async () => { calls.push('copyModelFiles') },
  db: {},
  deleteFrameworkModels: async () => { calls.push('deleteFrameworkModels') },
  dropSqliteTables: async () => { calls.push('dropSqliteTables') },
  fetchSqliteFile: () => sqliteFile,
  fetchTables: async () => [],
  migrateAuthTables: async () => {
    calls.push('migrateAuthTables')
    return { success: true }
  },
  migrateNotificationTables: async () => {
    calls.push('migrateNotificationTables')
    return { success: true }
  },
  migrateRbacTables: async () => {
    calls.push('migrateRbacTables')
    return { success: true }
  },
  migrateTraitTables: async () => {
    calls.push('migrateTraitTables')
    return { success: true }
  },
  runDatabaseMigration: async () => {
    calls.push('runDatabaseMigration')
    return migrationResult
  },
  ensureUtcDatetimeColumns: async () => ({ success: true }),
  ensureUtcTimestampDefaults: async () => ({ success: true }),
  sql: Object.assign(() => ({ execute: async () => {} }), { raw: (s: string) => s }),
}))

afterAll(() => {
  mock.module('@stacksjs/database', () => realDatabase)
  rmSync(tempDir, { recursive: true, force: true })
})

describe('test database framework-table guarantees (stacksjs/stacks#1948)', () => {
  it('truncateSqlite migrates auth/notification/RBAC/trait tables after model migrations', async () => {
    const { truncateSqlite } = await import('../src/database')
    await truncateSqlite()

    const migrated = calls.indexOf('runDatabaseMigration')
    expect(migrated).toBeGreaterThan(-1)
    // Before: 0000000098-revoke-legacy-long-lived-tokens.sql deletes from
    // oauth_access_tokens, which has to exist by then. And after: the
    // users.email_verified_at ALTER needs the users table the model
    // migrations create. Same order as `buddy migrate`.
    expect(calls.indexOf('migrateAuthTables')).toBeLessThan(migrated)
    expect(calls.lastIndexOf('migrateAuthTables')).toBeGreaterThan(migrated)
    expect(calls.indexOf('migrateNotificationTables')).toBeGreaterThan(migrated)
    expect(calls).toContain('migrateNotificationTables')
    expect(calls).toContain('migrateRbacTables')
    // commentables/taggables/categorizables have no model, so nothing in
    // runDatabaseMigration() creates them — a test DB without this step
    // fails any commentable/taggable trait call with "no such table".
    expect(calls).toContain('migrateTraitTables')
  })

  it('truncateSqlite throws when the model migrations fail, after the guarantees ran', async () => {
    const { truncateSqlite } = await import('../src/database')
    calls.length = 0
    migrationResult = { isErr: true, error: new Error('no such table: oauth_access_tokens') }
    try {
      await expect(truncateSqlite()).rejects.toThrow('Database migration failed: no such table: oauth_access_tokens')
      expect(calls).toContain('migrateTraitTables')
    }
    finally {
      migrationResult = { isOk: true }
    }
  })

  it('setupDatabase (mysql branch) wires the same guarantees', () => {
    // The mysql branch needs a live MySQL connection to execute, so the
    // wiring is pinned with a source-shape check — same pattern as
    // actions/tests/auth-setup-email-verified-at.test.ts.
    const source = readFileSync(join(import.meta.dir, '../src/database.ts'), 'utf-8')
    const setupIdx = source.indexOf('export async function setupDatabase')
    expect(setupIdx).toBeGreaterThan(-1)
    const nextFnIdx = source.indexOf('export async function', setupIdx + 1)
    const body = source.slice(setupIdx, nextFnIdx === -1 ? undefined : nextFnIdx)
    expect(body).toContain('await migrateTestDatabase()')
  })
})
