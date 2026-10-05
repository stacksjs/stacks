import { Database } from 'bun:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { existsSync, realpathSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * The migration runner and the app talk to the same database.
 *
 * The runner built its connection from `DB_*` alone while the app reads
 * `config/database.ts`, so an app whose config named its own SQLite file -
 * `database/smakelo.sqlite` - with nothing in `.env` was migrated into
 * `database/stacks.sqlite` and served from an empty file. Apps worked around it
 * by setting `DB_DATABASE_PATH` to repeat what their config already said.
 */
let project: string

beforeEach(async () => {
  project = realpathSync(await mkdtemp(join(tmpdir(), 'stacks-configured-db-')))
  await mkdir(join(project, 'config'), { recursive: true })
  await mkdir(join(project, 'database/migrations'), { recursive: true })
  await writeFile(join(project, 'bunfig.toml'), '# no preload\n')
  await writeFile(join(project, 'config/database.ts'), `export default {
  default: 'sqlite',
  connections: {
    sqlite: { database: 'database/custom.sqlite', prefix: '' },
  },
}
`)
  await writeFile(
    join(project, 'database/migrations/0000000001-create-teams-table.sql'),
    'CREATE TABLE IF NOT EXISTS "teams" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "name" TEXT);\n',
  )
  // SQLite cannot run this, so the preprocessor records it as skipped - in
  // whichever file it believes is the database. Recorded in the wrong one, the
  // runner then executes it against the right one and fails.
  await writeFile(
    join(project, 'database/migrations/0000000002-alter-teams-add-constraint.sql'),
    'ALTER TABLE "teams" ADD CONSTRAINT "teams_name_unique" UNIQUE ("name");\n',
  )
})

afterEach(async () => {
  await rm(project, { recursive: true, force: true })
})

describe('the database migrate writes is the one the app reads', () => {
  it('follows config/database.ts when DB_DATABASE_PATH is not set', async () => {
    const env: Record<string, string | undefined> = { ...process.env, APP_ENV: 'local', DB_CONNECTION: 'sqlite' }
    delete env.DB_DATABASE_PATH
    delete env.DB_MIGRATIONS_PATH
    delete env.DB_SNAPSHOT_PATH

    const child = Bun.spawn([
      process.execPath,
      `--config=${join(project, 'bunfig.toml')}`,
      '--no-env-file',
      `${import.meta.dir}/fixtures/migrate-configured-database.ts`,
    ], { cwd: project, env, stdout: 'pipe', stderr: 'pipe' })
    const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
    const line = stdout.trim().split('\n').reverse().find(candidate => candidate.startsWith('{'))
    if (code !== 0 || !line)
      throw new Error(`fixture exited ${code}\n${stdout}\n${stderr}`)
    const out = JSON.parse(line)

    expect(out.ok).toBe(true)
    expect(out.appFile).toBe(join(project, 'database/custom.sqlite'))
    expect(out.ledger).toContain('0000000001-create-teams-table.sql')
    expect(out.ledger).toContain('0000000002-alter-teams-add-constraint.sql')

    // The table is in the configured file, and no second database appeared.
    const db = new Database(join(project, 'database/custom.sqlite'))
    try {
      const tables = (db.query(`SELECT name FROM sqlite_master WHERE type = 'table'`).all() as Array<{ name: string }>).map(row => row.name)
      expect(tables).toContain('teams')
    }
    finally {
      db.close()
    }
    expect(existsSync(join(project, 'database/stacks.sqlite'))).toBe(false)
  }, 60_000)
})
