import { afterEach, describe, expect, it } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { findIgnoredMigrations, formatIgnoredMigrations, trackIgnoredGeneratedMigrations } from '../src/ignored-migrations'
import { GENERATED_MIGRATION_MARKER } from '../src/generated-migration-marker'

/**
 * A global `*.sql` ignore kept an app's new migrations out of every commit;
 * CI and the deploy built the database without them and the table's
 * requests all failed. These run against a real git repository.
 */
describe('findIgnoredMigrations', () => {
  const dirs: string[] = []
  afterEach(() => {
    for (const dir of dirs.splice(0))
      rmSync(dir, { recursive: true, force: true })
  })

  function project(gitignore: string | null): string {
    const root = mkdtempSync(join(tmpdir(), 'stacks-ignored-migrations-'))
    dirs.push(root)
    const migrations = join(root, 'database', 'migrations')
    mkdirSync(migrations, { recursive: true })
    writeFileSync(join(migrations, '0000000001-create-users-table.sql'), 'CREATE TABLE users (id INTEGER);')
    writeFileSync(join(migrations, '0000000002-create-plans-table.sql'), 'CREATE TABLE plans (id INTEGER);')
    writeFileSync(join(migrations, 'README.md'), 'not a migration')
    if (gitignore !== null) {
      spawnSync('git', ['init', '-q'], { cwd: root })
      // Isolate tests from the contributor's own machine-wide ignore rules.
      const excludes = join(root, '.git', 'test-excludes')
      writeFileSync(excludes, '')
      spawnSync('git', ['config', 'core.excludesFile', excludes], { cwd: root })
      writeFileSync(join(root, '.gitignore'), gitignore)
    }
    return migrations
  }

  it('names every migration a *.sql rule hides from git', () => {
    const migrations = project('*.sql\n')
    expect(findIgnoredMigrations(migrations)).toEqual([
      '0000000001-create-users-table.sql',
      '0000000002-create-plans-table.sql',
    ])
  })

  it('is satisfied once the project re-includes its migrations', () => {
    const migrations = project('*.sql\n!database/migrations/*.sql\n')
    expect(findIgnoredMigrations(migrations)).toEqual([])
  })

  it('says nothing outside a git checkout or for a missing directory', () => {
    expect(findIgnoredMigrations(project(null))).toEqual([])
    expect(findIgnoredMigrations(join(tmpdir(), 'no-such-dir-for-stacks'))).toEqual([])
  })

  it('explains the rule and the fix', () => {
    const migrations = project('*.sql\n')
    const message = formatIgnoredMigrations(findIgnoredMigrations(migrations), migrations)
    expect(message).toContain('2 migrations are ignored by git')
    expect(message).toContain('database/migrations/0000000002-create-plans-table.sql')
    expect(message).toContain('.gitignore:1:*.sql')
    expect(message).toContain('buddy generate:migrations')
    expect(message).toContain('git add --force')
    expect(message).not.toContain('!database/migrations')
  })

  const generated = '0000000001-create-users-table.sql'

  function stamp(dir: string, file = generated): string {
    const sql = `${GENERATED_MIGRATION_MARKER}\nCREATE TABLE users (id INTEGER);\n`
    writeFileSync(join(dir, file), sql)
    return sql
  }

  it('registers generated SQL hidden by a global ignore without staging its contents', () => {
    const migrations = project('')
    const root = join(migrations, '../..')
    const excludes = join(root, '.git', 'test-excludes')
    writeFileSync(excludes, '*.sql\n')
    const sql = stamp(migrations)
    const configBefore = readFileSync(join(root, '.git', 'config'), 'utf8')

    expect(trackIgnoredGeneratedMigrations(migrations)).toEqual([generated])
    expect(findIgnoredMigrations(migrations)).toEqual(['0000000002-create-plans-table.sql'])
    expect(readFileSync(join(migrations, generated), 'utf8')).toBe(sql)
    expect(readFileSync(join(root, '.gitignore'), 'utf8')).toBe('')
    expect(readFileSync(join(root, '.git', 'config'), 'utf8')).toBe(configBefore)
    expect(spawnSync('git', ['diff', '--cached', '--name-only'], { cwd: root, encoding: 'utf8' }).stdout).toBe('')
    expect(spawnSync('git', ['diff', '--name-only'], { cwd: root, encoding: 'utf8' }).stdout).toContain(generated)

    // Normal staging now includes the ignored generated file, but no raw SQL.
    expect(spawnSync('git', ['add', '-A'], { cwd: root }).status).toBe(0)
    const staged = spawnSync('git', ['diff', '--cached', '--name-only'], { cwd: root, encoding: 'utf8' }).stdout
    expect(staged).toContain(generated)
    expect(staged).not.toContain('0000000002-create-plans-table.sql')
    expect(trackIgnoredGeneratedMigrations(migrations)).toEqual([])
  })

  it('honors a custom dialect directory and an ignored parent directory', () => {
    const migrations = project('database/\n')
    const dialect = join(migrations, 'postgres')
    mkdirSync(dialect)
    stamp(dialect)
    expect(trackIgnoredGeneratedMigrations(dialect)).toEqual([generated])
    expect(findIgnoredMigrations(dialect)).toEqual([])
  })

  it('leaves already-staged migration content untouched', () => {
    const migrations = project('*.sql\n')
    const sql = stamp(migrations)
    spawnSync('git', ['add', '--force', '--', generated], { cwd: migrations })
    writeFileSync(join(migrations, generated), `${sql}CREATE INDEX users_idx ON users(id);\n`)
    expect(trackIgnoredGeneratedMigrations(migrations)).toEqual([])
    expect(spawnSync('git', ['show', `:database/migrations/${generated}`], { cwd: migrations, encoding: 'utf8' }).stdout).toBe(sql)
  })

  it('surfaces an index lock instead of silently losing generated schema history', () => {
    const migrations = project('*.sql\n')
    stamp(migrations)
    writeFileSync(join(migrations, '../../.git/index.lock'), '')
    expect(() => trackIgnoredGeneratedMigrations(migrations)).toThrow('Could not make generated migrations visible to Git')
    expect(findIgnoredMigrations(migrations)).toContain(generated)
  })

  it('does nothing without a checkout or when generated SQL is already visible', () => {
    const ordinary = project('')
    stamp(ordinary)
    expect(trackIgnoredGeneratedMigrations(ordinary)).toEqual([])
    const outside = project(null)
    stamp(outside)
    expect(trackIgnoredGeneratedMigrations(outside)).toEqual([])
  })
})
