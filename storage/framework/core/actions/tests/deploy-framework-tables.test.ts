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

  it('runs every framework-table guarantee, including the trait tables and the UTC datetime repair', () => {
    expect(source).toContain(`const { ensureUtcDatetimeColumns, migrateAuthTables, migrateNotificationTables, migrateRbacTables, migrateTraitTables } = await import('@stacksjs/database')`)
    // MySQL TIMESTAMP columns convert through the session timezone; a deploy
    // against a database migrated before the tables declared DATETIME has to
    // repair them or its timestamps stay timezone-fragile.
    expect(source).toContain(`['utc-datetime', ensureUtcDatetimeColumns]`)
    expect(source).toMatch(/await migrateTables\(\{ verbose: isVerbose \}\)/)
    // The polymorphic trait tables (commentables/taggables/categorizables)
    // have no model, so nothing else in the deploy path creates them.
    expect(source).toContain(`['trait', migrateTraitTables]`)
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
