import { afterEach, describe, expect, it } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { findIgnoredMigrations, formatIgnoredMigrations } from '../src/ignored-migrations'

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
    expect(message).toContain('!database/migrations/*.sql')
  })
})
