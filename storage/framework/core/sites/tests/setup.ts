/**
 * Sites package test harness.
 *
 * `provision.test.ts` drives `provisionSite`, which writes real rows through
 * the `db` proxy. It shipped with no database setup at all, so it only ever
 * passed on a machine that happened to have a `sites` table in whatever
 * database the ambient env pointed at. CI has neither, and the suite has
 * failed there since the test landed:
 *
 *   SQLiteError: no such table: sites
 *
 * Strategy mirrors `core/cms/src/tests/setup.ts`: pin env to a throwaway
 * SQLite file BEFORE any framework module loads, then create the tables this
 * package's code path touches.
 *
 * Two invocations have to work, and only one of them gets the env pin early:
 *
 *   - From this directory (`bun test`), `bunfig.toml`'s `[test] preload` runs
 *     this module first, so the pin lands before anything else resolves.
 *   - From the repo root (`bun test ./storage/framework/core/sites/tests`,
 *     which is what CI does), bunfig is read from the ROOT, so the preload
 *     never fires and this module is evaluated as an ordinary import - after
 *     the test file has already imported `@stacksjs/database`.
 *
 * The second case works because `forceConfig()` calls `initializeDbConfig`
 * explicitly rather than relying on the env alone: the `db` proxy is lazy, so
 * re-pinning the config before the first query still steers it. That is also
 * why `refreshDatabase` re-pins on every test rather than once at load.
 *
 * The DDL is kept in step with `database/migrations/` by hand, the same way
 * the CMS harness is - this runs without the migration pipeline. `sites`
 * follows `1785502251848-create-sites-table.sql`; the page tables follow the
 * CMS harness, because `provisionSite` seeds pages through
 * `@stacksjs/cms`'s `createPageDocument`.
 */

import { existsSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'

const DB_PATH = join(tmpdir(), `stacks-sites-${process.pid}.sqlite`)
process.env.DB_CONNECTION = 'sqlite'
process.env.DB_DATABASE_PATH = DB_PATH
process.env.APP_ENV = 'testing'

// Dynamic import AFTER the env pin so the lazy `db` proxy and the config
// loader can't capture a different connection first.
const { acquireDbConfigLock, db, ensureDatabaseConfigLoaded, initializeDbConfig } = await import('@stacksjs/database')

// Holds `initializeDbConfig`'s process-wide config mutex (stacksjs/stacks#1862)
// for this module's lifetime. Released on process exit alongside the file
// cleanup below - this is a shared fixture, not a test file, so it has no
// `afterAll` boundary of its own.

/**
 * Drain the one-shot async config reload, then force our temp SQLite config
 * so a late-resolving override can't re-point the shared `db` proxy mid-test.
 */
async function forceConfig(): Promise<void> {
  /*
   * Held for the MUTATION only. Acquiring at module scope and releasing from
   * the `process.on('exit')` handler meant holding it for the whole of
   * `bun test`, since every file shares one process - so each later file
   * wanting the lock waited out the full 60s watchdog before it could start
   * (stacksjs/stacks#2413).
   */
  const releaseDbConfigLock = await acquireDbConfigLock()

  try {
    await ensureDatabaseConfigLoaded()
    initializeDbConfig({
      app: { env: 'testing' },
      database: {
        default: 'sqlite',
        connections: { sqlite: { database: DB_PATH, prefix: '' } },
      },
    })
  }
  finally {
    releaseDbConfigLock()
  }
}

// A recycled pid would otherwise leak a previous run's schema and rows.
for (const suffix of ['', '-wal', '-shm']) {
  if (existsSync(`${DB_PATH}${suffix}`))
    unlinkSync(`${DB_PATH}${suffix}`)
}

await forceConfig()

// No REFERENCES clauses: `teams` does not exist in this harness, and the
// tenancy behaviour under test does not depend on FK enforcement.
await db.unsafe(`
  CREATE TABLE IF NOT EXISTS sites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid VARCHAR(255),
    name VARCHAR(255) NOT NULL,
    subdomain VARCHAR(255) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    settings TEXT,
    timezone VARCHAR(64) DEFAULT 'America/New_York',
    team_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
  )
`).execute()

await db.unsafe(`
  CREATE UNIQUE INDEX IF NOT EXISTS sites_subdomain_unique ON sites (subdomain)
`).execute()

await db.unsafe(`
  CREATE TABLE IF NOT EXISTS pages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid VARCHAR(255),
    site_id INTEGER,
    author_id INTEGER,
    parent_id INTEGER,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255),
    path VARCHAR(2048),
    template VARCHAR(255) NOT NULL DEFAULT 'default',
    blocks TEXT,
    meta_description VARCHAR(320),
    status VARCHAR(32) NOT NULL DEFAULT 'draft',
    scheduled_at TIMESTAMP,
    views INTEGER NOT NULL DEFAULT 0,
    conversions INTEGER NOT NULL DEFAULT 0,
    published_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
  )
`).execute()

await db.unsafe(`
  CREATE UNIQUE INDEX IF NOT EXISTS pages_site_path_unique ON pages (site_id, path)
`).execute()

// `createPageDocument` reaches `storeRevision` and `recordSlugChangeRedirects`
// through `@stacksjs/cms`'s page-document module, so both tables have to exist
// even when a given call writes neither.
await db.unsafe(`
  CREATE TABLE IF NOT EXISTS page_revisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    page_id INTEGER NOT NULL,
    author_id INTEGER,
    revision INTEGER NOT NULL,
    title VARCHAR(255) NOT NULL,
    blocks TEXT,
    meta_description VARCHAR(320),
    note VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
  )
`).execute()

await db.unsafe(`
  CREATE TABLE IF NOT EXISTS redirects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    site_id INTEGER NOT NULL,
    from_path VARCHAR(2048) NOT NULL,
    to_path VARCHAR(2048) NOT NULL,
    status_code INTEGER NOT NULL DEFAULT 301,
    source VARCHAR(32) NOT NULL DEFAULT 'manual',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
  )
`).execute()

const tableNames = ['pages', 'page_revisions', 'redirects', 'sites']

/**
 * Wipe between tests. DELETE (not DROP) keeps the schema warm, and re-pinning
 * the config per test is deliberate: `bun test` runs a whole directory in one
 * process and every file here claims the same process-wide database globals.
 */
export async function refreshDatabase(): Promise<void> {
  await forceConfig()
  for (const table of tableNames) {
    await db.unsafe(`DELETE FROM ${table}`).execute()
  }
}

// Cleanup on process exit, NOT in an `afterAll`: registered during module
// evaluation, an `afterAll` attaches to the FIRST importing file's scope and
// would unlink the shared database while later files still hold connections.
process.on('exit', () => {
  for (const suffix of ['', '-wal', '-shm']) {
    try {
      if (existsSync(`${DB_PATH}${suffix}`))
        unlinkSync(`${DB_PATH}${suffix}`)
    }
    catch {
      // Best effort - pid-named file in tmpdir, the OS reclaims it.
    }
  }
})
