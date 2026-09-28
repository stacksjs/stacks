import { Database } from 'bun:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { isMigratePreview } from '../src/commands/migrate'

/**
 * A dry run changes nothing.
 *
 * buddy registers `--dry-run` on every command ("Preview actions without making
 * changes"), and `migrate` ignored it: `buddy migrate --dry-run` ran a full
 * migrate, generating migration files, advancing the model snapshot and
 * applying all of it (trifitla, upgrading to 0.75.11). `migrate:fresh`
 * declared `--diff` and never read it, so `migrate:fresh --diff --force`
 * dropped every table.
 */

const root = join(import.meta.dir, '../../../../..')
const cli = join(root, 'storage/framework/core/buddy/src/cli.ts')

describe('isMigratePreview', () => {
  it('treats --diff, --dry-run and --pretend alike', () => {
    expect(isMigratePreview({ diff: true }, [])).toBe(true)
    expect(isMigratePreview({ dryRun: true }, [])).toBe(true)
    expect(isMigratePreview({ pretend: true }, [])).toBe(true)
    expect(isMigratePreview({}, ['bun', 'cli.ts', 'migrate', '--dry-run'])).toBe(true)
    expect(isMigratePreview({ diff: false }, ['bun', 'cli.ts', 'migrate'])).toBe(false)
  })
})

describe('buddy migrate --dry-run', () => {
  let dir: string
  let snapshot: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'migrate-dry-run-'))
    // A snapshot one model behind, so a real run would have something to write.
    const stored = JSON.parse(readFileSync(join(root, 'storage/framework/database/model-snapshot.sqlite.json'), 'utf8'))
    stored.plan.tables = stored.plan.tables.filter((table: { table: string }) => table.table !== 'referrals')
    snapshot = join(dir, 'model-snapshot.sqlite.json')
    writeFileSync(snapshot, JSON.stringify(stored, null, 2))
  })

  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  function run(...args: string[]): { exitCode: number, output: string } {
    const result = Bun.spawnSync([process.execPath, cli, ...args], {
      cwd: root,
      env: { ...process.env, DB_CONNECTION: 'sqlite', DB_DATABASE_PATH: join(dir, 'db.sqlite'), DB_SNAPSHOT_PATH: dir, CI: '1' },
      stdout: 'pipe',
      stderr: 'pipe',
    })
    return { exitCode: result.exitCode ?? 1, output: `${result.stdout}${result.stderr}` }
  }

  function corpus(): string[] {
    return readdirSync(join(root, 'database/migrations')).sort()
  }

  it('previews the pending change and writes neither files nor the snapshot', () => {
    const before = readFileSync(snapshot, 'utf8')
    const files = corpus()

    const { exitCode, output } = run('migrate', '--dry-run')
    expect(output).toContain('create_table on "referrals"')
    expect(exitCode).toBe(0)

    expect(readFileSync(snapshot, 'utf8')).toBe(before)
    expect(corpus()).toEqual(files)
  }, 60_000)

  it('makes migrate:fresh drop nothing', () => {
    const db = new Database(join(dir, 'db.sqlite'))
    db.run('CREATE TABLE keep_me (id INTEGER PRIMARY KEY)')
    db.run('INSERT INTO keep_me (id) VALUES (1)')
    db.close()

    for (const flag of ['--dry-run', '--diff', '--pretend']) {
      const { exitCode, output } = run('migrate:fresh', flag, '--force')
      expect(output).toContain('Would drop every table')
      expect(exitCode).toBe(0)
    }

    const after = new Database(join(dir, 'db.sqlite'))
    expect(after.query('SELECT COUNT(*) AS n FROM keep_me').get()).toEqual({ n: 1 })
    after.close()
  }, 60_000)
})
