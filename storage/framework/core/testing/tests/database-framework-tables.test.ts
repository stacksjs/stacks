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

const tempDir = mkdtempSync(join(tmpdir(), 'stacks-testing-db-'))
const sqliteFile = join(tempDir, 'test.sqlite')
writeFileSync(sqliteFile, '')

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
  runDatabaseMigration: async () => {
    calls.push('runDatabaseMigration')
    return { isOk: true }
  },
  sql: Object.assign(() => ({ execute: async () => {} }), { raw: (s: string) => s }),
}))

afterAll(() => {
  rmSync(tempDir, { recursive: true, force: true })
})

describe('test database framework-table guarantees (stacksjs/stacks#1948)', () => {
  it('truncateSqlite migrates auth/notification/RBAC tables after model migrations', async () => {
    const { truncateSqlite } = await import('../src/database')
    await truncateSqlite()

    expect(calls).toContain('runDatabaseMigration')
    // After, not before: the users.email_verified_at ALTER needs the
    // users table the model migrations create.
    expect(calls.indexOf('migrateAuthTables')).toBeGreaterThan(calls.indexOf('runDatabaseMigration'))
    expect(calls).toContain('migrateNotificationTables')
    expect(calls).toContain('migrateRbacTables')
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
    expect(body).toContain('await runDatabaseMigration()')
    expect(body.indexOf('await migrateFrameworkTables()')).toBeGreaterThan(body.indexOf('await runDatabaseMigration()'))
  })
})
