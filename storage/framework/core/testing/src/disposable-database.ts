/**
 * A database that exists for one test and is gone afterwards.
 *
 * A test that migrates, seeds and writes real rows needs a database nobody
 * else uses: not the developer's, not another test file's running in
 * parallel, and not last run's leftovers. `withDisposableDatabase` creates a
 * uniquely named one, hands its connection details to the test (as `env`,
 * ready for `runIsolated`), and drops it afterwards whether the test passed,
 * failed or threw.
 *
 * - **SQLite**: a file in a fresh temporary directory, removed with it.
 * - **PostgreSQL**: `CREATE DATABASE` on a server you name with a URL
 *   (`options.url`, else `STACKS_TEST_POSTGRES_URL`), then
 *   `DROP DATABASE ... WITH (FORCE)`, which also ends connections a crashed
 *   child left open. Only a server on this machine (`localhost`, `127.0.0.1`,
 *   `::1`) is accepted: creating and dropping databases is not something a
 *   test should be able to do to a shared or production server by a typo in
 *   an environment variable.
 *
 * Nothing here imports the framework, so it is safe at the top of any test.
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { SQL } from 'bun'

export type DisposableDialect = 'sqlite' | 'postgres'

export interface DisposableDatabaseOptions {
  /**
   * PostgreSQL server to create the database on, as a URL whose user may
   * `CREATE DATABASE` (`postgres://postgres@127.0.0.1:5432/postgres`).
   * Default `process.env.STACKS_TEST_POSTGRES_URL`.
   */
  url?: string
  /** Start of the database name (letters, digits, `_`). Default `stacks_test`. */
  prefix?: string
}

export interface DisposableDatabase {
  dialect: DisposableDialect
  /** The database name (Postgres) or file name (SQLite). Unique per call. */
  name: string
  /** A temporary directory that is removed with the database: put fixtures, a bunfig, logs here. */
  directory: string
  /** The SQLite file. */
  path?: string
  /** A connection URL for the new Postgres database. */
  url?: string
  /** `DB_*` variables that point a Stacks app at this database, for `runIsolated({ env })`. */
  env: Record<string, string>
}

export interface CreatedDisposableDatabase extends DisposableDatabase, AsyncDisposable {
  /** Drop the database and remove `directory`. Safe to call twice. */
  drop: () => Promise<void>
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])

/** The Postgres server URL disposable databases are created on, if one is configured. */
export function disposablePostgresUrl(options: Pick<DisposableDatabaseOptions, 'url'> = {}): string | undefined {
  return options.url || process.env.STACKS_TEST_POSTGRES_URL || undefined
}

/** Throws unless `url` is a Postgres URL for a server on this machine. */
export function assertLocalPostgres(url: string): URL {
  let parsed: URL
  try {
    parsed = new URL(url)
  }
  catch {
    throw new Error('A disposable Postgres database needs a postgres:// URL')
  }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol))
    throw new Error(`A disposable Postgres database needs a postgres:// URL, got ${parsed.protocol}`)
  if (!LOCAL_HOSTS.has(parsed.hostname))
    throw new Error(`Disposable databases are only created on a local PostgreSQL server (localhost, 127.0.0.1, ::1), not "${parsed.hostname}"`)
  return parsed
}

function uniqueName(prefix: string): string {
  const clean = prefix.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/^[^a-z_]+/, '') || 'stacks_test'
  // Postgres identifiers stop at 63 bytes; the random part keeps 24 hex characters.
  return `${clean.slice(0, 38)}_${crypto.randomUUID().replaceAll('-', '').slice(0, 24)}`
}

/**
 * Create a disposable database and return it with a `drop()` (also an
 * `await using` disposer). Prefer `withDisposableDatabase`, which cannot
 * forget to drop it.
 */
export async function createDisposableDatabase(dialect: DisposableDialect, options: DisposableDatabaseOptions = {}): Promise<CreatedDisposableDatabase> {
  if (dialect !== 'sqlite' && dialect !== 'postgres')
    throw new Error(`Disposable databases are sqlite or postgres, not "${String(dialect)}"`)
  const name = uniqueName(options.prefix ?? 'stacks_test')
  const directory = mkdtempSync(join(tmpdir(), `${name.slice(0, 20)}-`))
  let dropped = false

  if (dialect === 'sqlite') {
    const path = join(directory, `${name}.sqlite`)
    const drop = async () => {
      if (dropped) return
      dropped = true
      rmSync(directory, { recursive: true, force: true })
    }
    return {
      dialect,
      name,
      directory,
      path,
      env: { DB_CONNECTION: 'sqlite', DB_DATABASE_PATH: path },
      drop,
      [Symbol.asyncDispose]: drop,
    }
  }

  try {
    const server = disposablePostgresUrl(options)
    if (!server) throw new Error('A disposable Postgres database needs a server: pass options.url or set STACKS_TEST_POSTGRES_URL')
    const admin = assertLocalPostgres(server)
    const sql = new SQL(admin.href)
    try {
      await sql.unsafe(`CREATE DATABASE "${name}"`)
    }
    finally {
      await sql.close()
    }

    const target = new URL(admin.href)
    target.pathname = `/${name}`
    const drop = async () => {
      if (dropped) return
      dropped = true
      const cleanup = new SQL(admin.href)
      try {
        await cleanup.unsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`)
      }
      finally {
        await cleanup.close()
        rmSync(directory, { recursive: true, force: true })
      }
    }
    return {
      dialect,
      name,
      directory,
      url: target.href,
      env: {
        DB_CONNECTION: 'postgres',
        DB_HOST: admin.hostname.replace(/^\[|\]$/g, ''),
        DB_PORT: admin.port || '5432',
        DB_DATABASE: name,
        DB_USERNAME: decodeURIComponent(admin.username),
        DB_PASSWORD: decodeURIComponent(admin.password),
      },
      drop,
      [Symbol.asyncDispose]: drop,
    }
  }
  catch (error) {
    rmSync(directory, { recursive: true, force: true })
    throw error
  }
}

/**
 * Run `fn` against a fresh database, then drop it, even when `fn` throws.
 * A failure to drop is reported only when `fn` itself succeeded, so the
 * test's own error is never hidden behind a cleanup error.
 *
 * @example
 * for (const dialect of ['sqlite', 'postgres'] as const) {
 *   test.skipIf(dialect === 'postgres' && !disposablePostgresUrl())(`${dialect} checkout flow`, async () => {
 *     await withDisposableDatabase(dialect, async (database) => {
 *       const result = await runIsolated('tests/fixtures/checkout-flow.ts', { env: { APP_ENV: 'test', ...database.env }, timeoutMs: 45_000 })
 *       assertIsolatedOk(result, 'checkout flow OK')
 *     })
 *   }, 50_000)
 * }
 */
export async function withDisposableDatabase<T>(
  dialect: DisposableDialect,
  fn: (database: DisposableDatabase) => Promise<T> | T,
  options: DisposableDatabaseOptions = {},
): Promise<T> {
  const database = await createDisposableDatabase(dialect, options)
  let result: T
  try {
    result = await fn(database)
  }
  catch (error) {
    await database.drop().catch(() => {})
    throw error
  }
  await database.drop()
  return result
}
