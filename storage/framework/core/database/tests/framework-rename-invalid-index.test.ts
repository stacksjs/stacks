import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'

const legacySchema = `
CREATE TABLE "users" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "name" TEXT);
CREATE UNIQUE INDEX "users_users_uuid_unique" ON "users" ("uuid");
CREATE INDEX "users_users_nickname_index" ON "users" ("nickname");
CREATE TABLE "drivers" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "uuid" TEXT);
CREATE TABLE "delivery_routes" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "driver" TEXT,
  "driver_id" INTEGER REFERENCES "drivers"("id")
);
CREATE TABLE "driver_pings" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "driver_id" INTEGER REFERENCES "drivers"("id")
);
`

async function runFixture(root: string, migrations: string, databasePath: string): Promise<{ code: number, stdout: string, stderr: string }> {
  const child = Bun.spawn([
    process.execPath,
    `--config=${join(root, 'bunfig.toml')}`,
    '--no-env-file',
    `${import.meta.dir}/fixtures/framework-rename-invalid-index.ts`,
  ], {
    cwd: join(import.meta.dir, '../../../../..'),
    env: {
      ...process.env,
      APP_ENV: 'test',
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
  return { code, stdout, stderr }
}

test('a trait-backed index cannot block the post-migration framework rename pass', async () => {
  const root = await mkdtemp(join(tmpdir(), 'stacks-framework-rename-'))
  try {
    const migrations = join(root, 'migrations')
    const databasePath = join(root, 'app.sqlite')
    await mkdir(migrations, { recursive: true })
    await writeFile(join(root, 'bunfig.toml'), '# no preload\n')
    await writeFile(join(migrations, '0000000001-create-legacy-schema.sql'), legacySchema)

    const { code, stdout, stderr } = await runFixture(root, migrations, databasePath)

    expect(code, `${stdout}\n${stderr}`).toBe(0)
    expect(stdout).toContain('framework rename with trait index OK')
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
}, 60_000)

test('a trait-backed index cannot block the pre-migration framework rename pass', async () => {
  const root = await mkdtemp(join(tmpdir(), 'stacks-framework-rename-existing-'))
  try {
    const migrations = join(root, 'migrations')
    const databasePath = join(root, 'app.sqlite')
    const migrationName = '0000000001-create-legacy-schema.sql'
    await mkdir(migrations, { recursive: true })
    await writeFile(join(root, 'bunfig.toml'), '# no preload\n')
    await writeFile(join(migrations, migrationName), legacySchema)

    const database = new Database(databasePath)
    try {
      database.exec(legacySchema)
      // A user from before the uuid column existed. SQLite indexed this row
      // under the string 'uuid'; once the column is added that entry is stale
      // and the first write to the row fails as "database disk image is
      // malformed" unless the guarantee rebuilds the index.
      database.exec(`INSERT INTO "users" ("name") VALUES ('existing')`)
      database.exec(`CREATE TABLE migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        migration TEXT NOT NULL UNIQUE,
        executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`)
      database.query('INSERT INTO migrations (migration) VALUES (?)').run(migrationName)
    }
    finally {
      database.close()
    }

    const { code, stdout, stderr } = await runFixture(root, migrations, databasePath)

    expect(code, `${stdout}\n${stderr}`).toBe(0)
    expect(stdout).toContain('framework rename with trait index OK')
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
}, 60_000)
