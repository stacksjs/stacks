import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// stacksjs/stacks#1948 — `buddy deploy`'s migration step must apply the
// same framework-table guarantees as `buddy migrate`: auth/oauth tables
// (including the users.email_verified_at ALTER), notification tables,
// and RBAC tables. Pre-fix it ran only generateMigrations() +
// runDatabaseMigration(), so a production database migrated via deploy
// never received the column and the verify-email callback 500'd.
// deploy/index.ts is a top-level script that calls process.exit, so —
// like auth-setup-email-verified-at.test.ts — the regression guard is a
// source-shape check.

describe('deploy action ensures framework tables (stacksjs/stacks#1948)', () => {
  const deployPath = resolve(__dirname, '../src/deploy/index.ts')
  const source = readFileSync(deployPath, 'utf-8')

  it('runs migrateAuthTables, migrateNotificationTables and migrateRbacTables', () => {
    expect(source).toContain(`const { migrateAuthTables, migrateNotificationTables, migrateRbacTables } = await import('@stacksjs/database')`)
    expect(source).toMatch(/await migrateTables\(\{ verbose: isVerbose \}\)/)
  })

  it('runs the guarantees outside the model-migration try/catch so a migration failure cannot skip them (stacksjs/stacks#1952)', () => {
    // The model-migration catch deliberately doesn't fail the deploy; the
    // framework-table step must come after it (its own try/catch), not
    // inside the same try block where a runDatabaseMigration throw would
    // skip it.
    const modelMigrationCatch = source.indexOf('Database migrations skipped')
    const frameworkTablesStep = source.indexOf('migrateAuthTables')
    expect(modelMigrationCatch).toBeGreaterThan(-1)
    expect(frameworkTablesStep).toBeGreaterThan(modelMigrationCatch)
  })
})
