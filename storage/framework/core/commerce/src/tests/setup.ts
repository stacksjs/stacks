/**
 * Commerce package test harness.
 *
 * These suites used to import `refreshDatabase` from
 * `@stacksjs/testing/database`, which (pre-existing breakage) never
 * worked from a package directory: `bun test` run from
 * storage/framework/core/commerce doesn't load the repo-root `.env`,
 * so the driver fell back to mysql and the helper's dead kysely-era
 * `sql\`...\`.execute(db)` calls threw in every `beforeEach`. Even
 * forced to sqlite, the migration pipeline resolves `database/` and
 * `database/migrations` off `process.cwd()` and the committed
 * migration corpus is both unrunnable on a virgin DB and drifted from
 * the models (missing `uuid` columns for the 28 `useUuid` commerce
 * models).
 *
 * Strategy (mirrors auth/tests/password-reset-revocation.test.ts): pin
 * env to a throwaway SQLite file BEFORE any framework module loads,
 * then generate the schema directly from the live model definitions
 * via bun-query-builder's loadModels → buildMigrationPlan →
 * generateSql. Foreign-key references are stripped from the plan
 * because the fixtures intentionally insert dangling parent ids
 * (e.g. customer_id 1..3 with no customers row).
 *
 * Wired up via this package's bunfig.toml `[test] preload`, so the
 * env pin always lands before any test file's own imports evaluate.
 */

import { existsSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'

const DB_PATH = join(tmpdir(), `stacks-commerce-${process.pid}.sqlite`)
process.env.DB_CONNECTION = 'sqlite'
process.env.DB_DATABASE_PATH = DB_PATH
process.env.APP_ENV = 'testing'

// Dynamic imports AFTER the env pin so the lazy `db` proxy and the
// config loader can't capture a different connection first.
const { acquireDbConfigLock, db, ensureDatabaseConfigLoaded, initializeDbConfig } = await import('@stacksjs/database')
const { buildMigrationPlan, generateSql, loadModels } = await import('bun-query-builder')

// Holds `initializeDbConfig`'s process-wide config mutex (stacksjs/stacks#1862)
// for this module's entire lifetime — no `describe`/`afterAll` boundary exists
// here (this is a shared fixture imported by many test files, not a test file
// itself), so it's released on process exit alongside the file cleanup below.
const releaseDbConfigLock = await acquireDbConfigLock()

// storage/framework/defaults — the framework's vendor layer where the
// default model definitions live. `loadModels` does not recurse, so the
// commerce subdirectory is loaded explicitly and merged.
const defaultsModelsDir = join(import.meta.dir, '../../../../defaults/app/Models')
const commerceModelsDir = join(defaultsModelsDir, 'commerce')

/**
 * Drain the one-shot async config reload, then force our temp SQLite
 * config so a late-resolving override can't re-point the shared `db`
 * proxy at a different database mid-test.
 */
async function forceConfig(): Promise<void> {
  await ensureDatabaseConfigLoaded()
  initializeDbConfig({
    app: { env: 'testing' },
    database: {
      default: 'sqlite',
      connections: { sqlite: { database: DB_PATH, prefix: '' } },
    },
  })
}

// Stale file from a recycled pid would otherwise leak a previous run's
// schema/rows into this one.
for (const suffix of ['', '-wal', '-shm']) {
  if (existsSync(`${DB_PATH}${suffix}`))
    unlinkSync(`${DB_PATH}${suffix}`)
}

await forceConfig()

const models = {
  ...(await loadModels({ modelsDir: defaultsModelsDir })),
  ...(await loadModels({ modelsDir: commerceModelsDir })),
}

const plan = buildMigrationPlan(models, { dialect: 'sqlite' })

// The fixtures insert dangling parent ids by design (e.g. orders with
// customer_id 1 and no customers row), so FK constraints would reject
// most of the corpus. Strip references — the suites exercise the
// commerce modules' query logic, not referential integrity.
for (const table of plan.tables) {
  for (const column of table.columns)
    delete column.references
}

// `generateSql()` also writes one `.sql` migration file per statement
// into `<nearest package.json dir>/database/migrations` (resolved off
// `process.cwd()`) as a side effect — from this package's cwd that
// would litter storage/framework/core/commerce/database/. Point the
// side effect at a disposable temp workspace for the duration of the
// call. The stub package.json makes its workspace-root walk stop there.
const scratchDir = mkdtempSync(join(tmpdir(), 'stacks-commerce-migrations-'))
writeFileSync(join(scratchDir, 'package.json'), '{}')
const originalCwd = process.cwd()
let statements: string[]
try {
  process.chdir(scratchDir)
  statements = generateSql(plan)
}
finally {
  process.chdir(originalCwd)
  rmSync(scratchDir, { recursive: true, force: true })
}

for (const statement of statements) {
  await db.unsafe(statement).execute()
}

const tableNames = plan.tables.map(table => table.table)

/**
 * Wipe every model-derived table between tests. DELETE (not DROP) keeps
 * the schema warm; with FK references stripped, order doesn't matter.
 */
export async function refreshDatabase(): Promise<void> {
  await forceConfig()
  for (const table of tableNames) {
    await db.unsafe(`DELETE FROM ${table}`).execute()
  }
}

// Cleanup on process exit, NOT in an `afterAll`: when this module is
// imported by a test file mid-run (e.g. `bun test tests/` from the
// repo root, where the path filter also matches these suites), an
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
  releaseDbConfigLock()
})
