/**
 * CMS package test harness.
 *
 * This suite used to import `refreshDatabase` from
 * `@stacksjs/testing/database`, which (pre-existing breakage) never
 * worked from a package directory: `bun test` run from
 * storage/framework/core/cms doesn't load the repo-root `.env`, so the
 * driver fell back to mysql and the helper's dead kysely-era
 * `sql\`...\`.execute(db)` calls threw in every `beforeEach`.
 *
 * Strategy (mirrors auth/tests/password-reset-revocation.test.ts): pin
 * env to a throwaway SQLite file BEFORE any framework module loads,
 * then hand-create the two trait tables the categorizables module
 * touches. `categorizables`/`categorizable_models` are trait tables
 * (created by the categorizable model trait, not a model definition),
 * so there is no model file to derive them from.
 *
 * Wired up via this package's bunfig.toml `[test] preload`, so the
 * env pin always lands before any test file's own imports evaluate.
 */

import { existsSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'

const DB_PATH = join(tmpdir(), `stacks-cms-${process.pid}.sqlite`)
process.env.DB_CONNECTION = 'sqlite'
process.env.DB_DATABASE_PATH = DB_PATH
process.env.APP_ENV = 'testing'

// Dynamic import AFTER the env pin so the lazy `db` proxy and the
// config loader can't capture a different connection first.
const { acquireDbConfigLock, db, ensureDatabaseConfigLoaded, initializeDbConfig } = await import('@stacksjs/database')

// Holds `initializeDbConfig`'s process-wide config mutex (stacksjs/stacks#1862)
// for this module's entire lifetime — no `describe`/`afterAll` boundary exists
// here (this is a shared fixture imported by many test files, not a test file
// itself), so it's released on process exit alongside the file cleanup below.

/**
 * Drain the one-shot async config reload, then force our temp SQLite
 * config so a late-resolving override can't re-point the shared `db`
 * proxy at a different database mid-test.
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

// Stale file from a recycled pid would otherwise leak a previous run's
// schema/rows into this one.
for (const suffix of ['', '-wal', '-shm']) {
  if (existsSync(`${DB_PATH}${suffix}`))
    unlinkSync(`${DB_PATH}${suffix}`)
}

await forceConfig()

await db.unsafe(`
  CREATE TABLE IF NOT EXISTS categorizables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    description TEXT,
    categorizable_type VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
  )
`).execute()

await db.unsafe(`
  CREATE TABLE IF NOT EXISTS categorizable_models (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL,
    categorizable_id INTEGER NOT NULL,
    categorizable_type VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
  )
`).execute()

await db.unsafe(`
  CREATE TABLE IF NOT EXISTS taggable_models (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tag_id INTEGER NOT NULL,
    taggable_id INTEGER NOT NULL,
    taggable_type VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
  )
`).execute()

// Real-pages tables: pages carries the block-document columns the Page model
// declares; the rest back revisions, redirects and menus. Hand-created here
// for the same reason as the trait tables — this harness runs without the
// migration pipeline.
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

await db.unsafe(`
  CREATE TABLE IF NOT EXISTS menus (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    site_id INTEGER NOT NULL,
    handle VARCHAR(64) NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
  )
`).execute()

await db.unsafe(`
  CREATE TABLE IF NOT EXISTS menu_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    menu_id INTEGER NOT NULL,
    page_id INTEGER,
    label VARCHAR(120) NOT NULL,
    url VARCHAR(2048),
    target VARCHAR(8) DEFAULT '_self',
    parent_id INTEGER,
    position INTEGER DEFAULT 0,
    visibility VARCHAR(16) DEFAULT 'public',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
  )
`).execute()

const tableNames = ['categorizables', 'categorizable_models', 'taggable_models', 'pages', 'page_revisions', 'redirects', 'menus', 'menu_items']

/**
 * Wipe the trait tables between tests. DELETE (not DROP) keeps the
 * schema warm.
 */
export async function refreshDatabase(): Promise<void> {
  await forceConfig()
  for (const table of tableNames) {
    await db.unsafe(`DELETE FROM ${table}`).execute()
  }
}

// Cleanup on process exit, NOT in an `afterAll`: when this module is
// imported by a test file mid-run (e.g. `bun test tests/` from the
// repo root, where the path filter also matches this suite), an
// `afterAll` registered during module evaluation attaches to the FIRST
// importing file's scope and unlinks the shared DB while later files'
// connections still use it (SQLITE_IOERR_VNODE).
process.on('exit', () => {
  for (const suffix of ['', '-wal', '-shm']) {
    try {
      if (existsSync(`${DB_PATH}${suffix}`))
        unlinkSync(`${DB_PATH}${suffix}`)
    }
    catch {
      // Best effort — pid-named file in tmpdir, the OS reclaims it.
    }
  }
})
