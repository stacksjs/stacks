import { describe, expect, test } from 'bun:test'
import process from 'node:process'
import { join } from 'node:path'
import { SQL } from 'bun'
import { projectPath } from '@stacksjs/path'
import { disposablePostgresUrl, withDisposableDatabase } from '../src/disposable-database'
import type { DisposableDatabase } from '../src/disposable-database'

// refreshDatabase() on Postgres empties the live tables with one
// `TRUNCATE ... RESTART IDENTITY` (stacksjs/stacks#3355). A mock can
// pin the statement but not that Postgres accepts it, so this runs it against
// a real disposable database. `db` is configured from the environment at
// import, so the helper runs in a child process pointed at that database.
// It runs from the project root: config overrides resolve `config/*.ts`
// against the working directory, and from this package's directory the
// framework default (sqlite) would win over DB_CONNECTION.
async function truncateIn(database: DisposableDatabase): Promise<{ code: number, stderr: string }> {
  const child = Bun.spawn([process.execPath, '-e', `
    const { truncatePostgres } = await import(${JSON.stringify(join(import.meta.dir, '../src/database.ts'))})
    await truncatePostgres()
    process.exit(0)
  `], {
    cwd: projectPath(),
    env: { ...process.env, ...database.env },
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const [stderr, code] = await Promise.all([new Response(child.stderr).text(), child.exited])
  return { code, stderr }
}

function connect(database: DisposableDatabase): SQL {
  if (!database.sqlOptions)
    throw new Error('Missing disposable PostgreSQL connection options')
  return new SQL(database.sqlOptions)
}

async function seed(database: DisposableDatabase): Promise<void> {
  const sql = connect(database)
  try {
    await sql.unsafe(`
      CREATE TABLE migrations (id serial PRIMARY KEY, migration varchar(255) NOT NULL UNIQUE);
      CREATE TABLE users (id serial PRIMARY KEY, email text NOT NULL);
      CREATE TABLE orders (id serial PRIMARY KEY, user_id int NOT NULL REFERENCES users (id));
      CREATE TABLE "AuditLog" (id serial PRIMARY KEY, note text);
      INSERT INTO migrations (migration) VALUES ('0001-create-users'), ('0002-create-orders');
      INSERT INTO users (email) VALUES ('a@example.test'), ('b@example.test');
      INSERT INTO orders (user_id) VALUES (1), (2);
      INSERT INTO "AuditLog" (note) VALUES ('seeded');
    `)
  }
  finally {
    await sql.close()
  }
}

async function counts(database: DisposableDatabase): Promise<Record<string, number>> {
  const sql = connect(database)
  try {
    const [row] = await sql.unsafe(`SELECT
      (SELECT count(*)::int FROM migrations) AS migrations,
      (SELECT count(*)::int FROM users) AS users,
      (SELECT count(*)::int FROM orders) AS orders,
      (SELECT count(*)::int FROM "AuditLog") AS audit`)
    return row
  }
  finally {
    await sql.close()
  }
}

// Runs where a local server is configured: STACKS_TEST_POSTGRES_URL=postgres://postgres@127.0.0.1:5432/postgres
describe.skipIf(!disposablePostgresUrl())('truncatePostgres (postgres)', () => {
  test('empties every table but the migration ledger and restarts their ids', async () => {
    await withDisposableDatabase('postgres', async (database) => {
      await seed(database)

      const result = await truncateIn(database)
      expect(result.code, result.stderr).toBe(0)

      // orders references users; truncating both in one statement satisfies it.
      expect(await counts(database)).toEqual({ migrations: 2, users: 0, orders: 0, audit: 0 })
      const sql = connect(database)
      try {
        const [user] = await sql`INSERT INTO users (email) VALUES ('c@example.test') RETURNING id`
        expect(user.id).toBe(1)
      }
      finally {
        await sql.close()
      }
    })
  }, 60_000)

  test('refuses a database whose name does not say it is for tests', async () => {
    await withDisposableDatabase('postgres', async (database) => {
      await seed(database)

      const result = await truncateIn(database)
      expect(result.code).not.toBe(0)
      expect(result.stderr).toContain('Refusing to reset Postgres database')
      expect(await counts(database)).toEqual({ migrations: 2, users: 2, orders: 2, audit: 1 })
    }, { prefix: 'stacks_dev' })
  }, 60_000)
})
