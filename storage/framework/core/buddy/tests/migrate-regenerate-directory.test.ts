import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'

/**
 * `migrate:regenerate` names the directory it wrote (stacksjs/stacks#3001).
 *
 * It always said "database/migrations", including when DB_MIGRATIONS_PATH (or
 * a per-dialect directory) had sent the files somewhere else, so the one line
 * telling you where to look for 110 new files pointed at the wrong place.
 */

const root = join(import.meta.dir, '../../../../..')
const cli = join(root, 'storage/framework/core/buddy/src/cli.ts')

describe('buddy migrate:regenerate', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'migrate-regenerate-dir-'))
    // An empty consumer project on the default schema, as in migrate-dry-run.
    mkdirSync(join(dir, 'storage/framework'), { recursive: true })
    symlinkSync(join(root, 'storage/framework/defaults'), join(dir, 'storage/framework/defaults'), 'dir')
    symlinkSync(join(root, 'node_modules'), join(dir, 'node_modules'), 'dir')
    writeFileSync(join(dir, 'package.json'), '{}\n')
    writeFileSync(join(dir, 'bunfig.toml'), 'preload = []\n')
  })

  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it('reports the directory DB_MIGRATIONS_PATH sent the corpus to', () => {
    const result = Bun.spawnSync([process.execPath, `--config=${join(dir, 'bunfig.toml')}`, '--no-env-file', cli, 'migrate:regenerate', 'sqlite'], {
      cwd: dir,
      env: {
        ...process.env,
        DB_CONNECTION: 'sqlite',
        DB_DATABASE_PATH: join(dir, 'db.sqlite'),
        DB_MIGRATIONS_PATH: 'schema/sqlite',
        DB_SNAPSHOT_PATH: dir,
        CI: '1',
      },
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const output = `${result.stdout}${result.stderr}`

    expect(result.exitCode, output).toBe(0)
    const written = readdirSync(join(dir, 'schema/sqlite')).filter(file => file.endsWith('.sql'))
    expect(written.length).toBeGreaterThan(0)
    expect(existsSync(join(dir, 'database/migrations'))).toBe(false)

    expect(output).toContain(`${written.length} migration file(s) will be written to schema/sqlite`)
    expect(output).toContain(`Wrote ${written.length} sqlite migration file(s) to schema/sqlite.`)
    expect(output).not.toContain('to database/migrations')
  }, 90_000)
})
