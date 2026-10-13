import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Two migration files with one number run in alphabetical order, not the
// author's, and they are the mark of a generator that numbered without seeing
// everything (two branches each writing the same ordinal). `--strict` refuses
// such a corpus before anything runs. The command calls process.exit, so - like
// migrate-guarantees-ordering.test.ts - the wiring is pinned by source shape;
// the detection itself is tested in database/tests/migration-names.test.ts.
describe('buddy migrate --strict and duplicated migration numbers', () => {
  const source = readFileSync(resolve(__dirname, '../src/commands/migrate.ts'), 'utf-8')
  const migrateSection = source.slice(source.indexOf(`.command('migrate'`), source.indexOf(`.command('migrate:fresh'`))

  it('checks before any database work, and exits when strict refuses', () => {
    const check = migrateSection.indexOf('await reportDuplicateMigrationNumbers({ strict: strictMode(options) })')
    expect(check).toBeGreaterThan(-1)
    expect(migrateSection.slice(check, check + 200)).toContain('process.exit(ExitCode.FatalError)')
    for (const later of ['isMigratePreview(options)', 'await preflightDatabase(', 'await runAction(Action.Migrate, options)'])
      expect(migrateSection.indexOf(later)).toBeGreaterThan(check)
  })

  it('refuses every duplicate under --strict, and warns about generated ones otherwise', () => {
    const helper = source.slice(source.indexOf('async function reportDuplicateMigrationNumbers'))
    expect(helper).toContain('options.strict ? groups : groups.filter(group => group.generated)')
    expect(helper).toContain('duplicateMigrationOrdinalsIn(await activeMigrationDirectory())')
  })
})
