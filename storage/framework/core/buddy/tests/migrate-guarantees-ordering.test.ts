import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// stacksjs/stacks#1952 — a model-migration failure must not skip the
// auth/notification/RBAC table guarantees. The sqlite self-heal replays
// poisoned unique-index migrations; real duplicate rows make the replayed
// CREATE UNIQUE INDEX hard-fail, which aborts the qb runner and makes
// runAction(Action.Migrate) return isErr. Pre-fix the command
// process.exit(FatalError)'d before the migrateAuthTables block, so the
// dirtiest legacy databases — the ones with duplicate rows — never
// received #1948's users.email_verified_at ALTER nor the
// oauth/notification/RBAC tables. The migrate command registers CLI
// actions and calls process.exit, so — like
// actions/tests/auth-setup-email-verified-at.test.ts — the ordering is
// pinned with a source-shape check.

describe('buddy migrate guarantee-table ordering (stacksjs/stacks#1952)', () => {
  const migratePath = resolve(__dirname, '../src/commands/migrate.ts')
  const source = readFileSync(migratePath, 'utf-8')

  // Slice the source into per-command sections so each assertion can't
  // accidentally match the other command's body.
  const freshIdx = source.indexOf(`.command('migrate:fresh'`)
  const dnsIdx = source.indexOf(`.command('migrate:dns'`)
  const migrateSection = source.slice(0, freshIdx)
  const freshSection = source.slice(freshIdx, dnsIdx)
  const freshAction = readFileSync(resolve(__dirname, '../../actions/src/migrate/fresh.ts'), 'utf-8')

  it('migrate: runs migrateAuthTables before the isErr FatalError exit', () => {
    const authCall = migrateSection.indexOf('await migrateAuthTables')
    const failureExit = migrateSection.indexOf('While running the migrate command, there was an issue')
    expect(authCall).toBeGreaterThan(-1)
    expect(failureExit).toBeGreaterThan(authCall)
  })

  it('migrate: lets model migrations create notification tables before framework guarantees', () => {
    const modelMigrate = migrateSection.indexOf('await runAction(Action.Migrate, options)')
    const notificationCall = migrateSection.indexOf('await migrateNotificationTables')
    const failureExit = migrateSection.indexOf('While running the migrate command, there was an issue')
    expect(modelMigrate).toBeGreaterThan(-1)
    expect(notificationCall).toBeGreaterThan(modelMigrate)
    expect(failureExit).toBeGreaterThan(notificationCall)
  })

  it('migrate:fresh: runs migrateAuthTables before the isErr FatalError exit', () => {
    const authCall = freshSection.indexOf('await migrateAuthTables')
    const failureExit = freshSection.indexOf('While running the migrate:fresh command, there was an issue')
    expect(authCall).toBeGreaterThan(-1)
    expect(failureExit).toBeGreaterThan(authCall)
  })

  it('migrate:fresh action lets model migrations own notification tables', () => {
    const authCall = freshAction.indexOf('await migrateAuthTables')
    const modelMigrate = freshAction.indexOf('await runDatabaseMigration')
    const notificationCall = freshAction.indexOf('await migrateNotificationTables')
    const failureExit = freshAction.indexOf("log.error('runDatabaseMigration failed')")
    expect(authCall).toBeGreaterThan(-1)
    expect(modelMigrate).toBeGreaterThan(authCall)
    expect(notificationCall).toBeGreaterThan(modelMigrate)
    expect(failureExit).toBeGreaterThan(notificationCall)
  })

  it('both commands still exit FatalError after a failed model migration', () => {
    for (const [section, outroText] of [
      [migrateSection, 'While running the migrate command, there was an issue'],
      [freshSection, 'While running the migrate:fresh command, there was an issue'],
    ] as const) {
      const failureOutro = section.indexOf(outroText)
      const exitIdx = section.indexOf('process.exit(ExitCode.FatalError)', failureOutro)
      expect(failureOutro).toBeGreaterThan(-1)
      expect(exitIdx).toBeGreaterThan(failureOutro)
    }
  })
})
