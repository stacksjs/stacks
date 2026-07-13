import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Migration safety guards. `buddy migrate` and `buddy migrate:fresh` both
// touch (and migrate:fresh DROPS) a real database, so both are gated behind
// human confirmation configured by `database.safety` in config/database.ts:
//   - confirmMigrate   → interactive confirm before `migrate` applies changes
//   - migrateFresh     → 'allow' | 'confirm' | 'disabled' for `migrate:fresh`
//
// The command registers CLI actions and calls process.exit, so — like
// migrate-guarantees-ordering.test.ts — the wiring is pinned with a
// source-shape check rather than by booting the CLI.

describe('buddy migrate safety guards', () => {
  const migratePath = resolve(__dirname, '../src/commands/migrate.ts')
  const source = readFileSync(migratePath, 'utf-8')

  const freshIdx = source.indexOf(`.command('migrate:fresh'`)
  const dnsIdx = source.indexOf(`.command('migrate:dns'`)
  const migrateSection = source.slice(0, freshIdx)
  const freshSection = source.slice(freshIdx, dnsIdx)

  it('resolves guards from config + env with a production-safe default', () => {
    // env override beats config; config beats built-in default.
    expect(source).toContain('parseGuardBool(process.env.DB_MIGRATE_CONFIRM)')
    expect(source).toContain('parseFreshGuard(process.env.DB_MIGRATE_FRESH)')
    // built-in default: confirm on, migrate:fresh disabled in production
    expect(source).toContain('?? true')
    expect(source).toContain(`isProd ? 'disabled' : 'allow'`)
  })

  it('migrate: prompts before applying, bypassable with --force, skipped in CI', () => {
    expect(migrateSection).toContain('guards.confirmMigrate && !options.force')
    // non-interactive runs must not block a deploy pipeline
    expect(migrateSection).toContain('isCI || !hasTTY')
    // a declined prompt cancels without applying anything
    expect(migrateSection).toContain('Migration cancelled — no changes applied.')
  })

  it('migrate:fresh: hard kill-switch refuses when the guard is "disabled"', () => {
    const disabledCheck = freshSection.indexOf(`guards.migrateFresh === 'disabled'`)
    const refuseExit = freshSection.indexOf('process.exit(ExitCode.FatalError)', disabledCheck)
    expect(disabledCheck).toBeGreaterThan(-1)
    // the kill-switch exits fatally BEFORE runAction(Action.MigrateFresh)
    const dropAction = freshSection.indexOf('runAction(Action.MigrateFresh')
    expect(refuseExit).toBeGreaterThan(disabledCheck)
    expect(refuseExit).toBeLessThan(dropAction)
  })

  it('migrate:fresh: requires a typed confirmation, --force only bypasses under "allow"', () => {
    // --force can only bypass when the guard is explicitly 'allow'
    expect(freshSection).toContain(`guards.migrateFresh === 'allow' && options.force === true`)
    // interactive confirmation is a typed match on the database name
    expect(freshSection).toContain('Type the database name')
    expect(freshSection).toContain('typed.trim() !== dbLabel')
    // the confirmation gate sits before the destructive action
    const gate = freshSection.indexOf('Type the database name')
    const dropAction = freshSection.indexOf('runAction(Action.MigrateFresh')
    expect(gate).toBeGreaterThan(-1)
    expect(gate).toBeLessThan(dropAction)
  })
})
