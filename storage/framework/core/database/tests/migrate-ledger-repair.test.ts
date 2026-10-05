import { Database } from 'bun:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * stacksjs/stacks#2860, against the real runner and a real SQLite file.
 *
 * Two promises `buddy migrate` has to keep. It never reports success while a
 * file it could see is still unapplied, and a table whose migration is
 * recorded but which is not in the database can be rebuilt without
 * `migrate:fresh` dropping everything else.
 */
let root: string
let migrations: string
let databasePath: string

async function step(name: string): Promise<Record<string, any>> {
  const child = Bun.spawn([
    process.execPath,
    `--config=${join(root, 'bunfig.toml')}`,
    '--no-env-file',
    `${import.meta.dir}/fixtures/migrate-ledger-repair.ts`,
  ], {
    cwd: join(import.meta.dir, '../../../../..'),
    env: {
      ...process.env,
      APP_ENV: 'test',
      FIXTURE_STEP: name,
      DB_CONNECTION: 'sqlite',
      DB_DATABASE_PATH: databasePath,
      DB_MIGRATIONS_PATH: migrations,
      DB_SNAPSHOT_PATH: root,
      STACKS_CANONICAL_FEATURES: '1',
    },
    stdout: 'pipe',
    stderr: 'pipe',
  })

  const [code, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ])
  const line = stdout.trim().split('\n').reverse().find(candidate => candidate.startsWith('{'))
  if (code !== 0 || !line)
    throw new Error(`fixture step ${name} exited ${code}\n${stdout}\n${stderr}`)
  return JSON.parse(line)
}

function query<T = Record<string, any>>(sql: string): T[] {
  const db = new Database(databasePath)
  try {
    return db.query(sql).all() as T[]
  }
  finally {
    db.close()
  }
}

const tables = (): string[] =>
  query<{ name: string }>(`SELECT name FROM sqlite_master WHERE type = 'table'`).map(row => row.name)

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'stacks-ledger-repair-'))
  migrations = join(root, 'migrations')
  databasePath = join(root, 'app.sqlite')
  await mkdir(migrations, { recursive: true })
  await writeFile(join(root, 'bunfig.toml'), '# no preload\n')
  await writeFile(
    join(migrations, '0000000001-create-teams-table.sql'),
    'CREATE TABLE IF NOT EXISTS "teams" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "name" TEXT);\n',
  )
  await writeFile(
    join(migrations, '0000000002-create-repair_settings-table.sql'),
    'CREATE TABLE IF NOT EXISTS "repair_settings" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "team_id" INTEGER);\n'
    + 'CREATE INDEX IF NOT EXISTS "repair_settings_team_id_index" ON "repair_settings" ("team_id");\n',
  )
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('buddy migrate and the ledger (stacksjs/stacks#2860)', () => {
  it('applies the corpus and passes its own completeness check', async () => {
    const first = await step('migrate')
    expect(first).toEqual({ ok: true, message: 'Applied 2 migrations.' })
    expect(tables()).toContain('repair_settings')

    // A second run is a no-op, not a false alarm.
    expect(await step('migrate')).toEqual({ ok: true, message: 'Nothing to migrate.' })
  }, 60_000)

  it('fails instead of reporting success when the runner left files unapplied', async () => {
    const result = await step('migrate-skipping')

    expect(result.ok).toBe(false)
    expect(result.message).toContain('2 migration files are still not recorded')
    expect(result.message).toContain('0000000001-create-teams-table.sql')
  }, 60_000)

  it('rebuilds a dropped table from its recorded migrations, without touching the rest', async () => {
    await step('migrate')
    const db = new Database(databasePath)
    db.run(`INSERT INTO teams (name) VALUES ('Core')`)
    db.run('DROP TABLE repair_settings')
    db.close()

    // Recorded, so a plain migrate skips it: the state the issue reports.
    expect(await step('migrate')).toEqual({ ok: true, message: 'Nothing to migrate.' })
    expect(tables()).not.toContain('repair_settings')

    const requeue = await step('requeue')
    expect(requeue.requeued).toEqual(['0000000002-create-repair_settings-table.sql'])

    expect(await step('migrate')).toEqual({ ok: true, message: 'Applied 1 migration.' })
    expect(tables()).toContain('repair_settings')
    expect(query(`SELECT name FROM teams`)).toEqual([{ name: 'Core' }])
  }, 60_000)
})
