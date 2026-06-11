import { config } from '@stacksjs/config'
import {
  copyModelFiles,
  db,
  deleteFrameworkModels,
  dropSqliteTables,
  fetchSqliteFile,
  fetchTables,
  migrateAuthTables,
  migrateNotificationTables,
  migrateRbacTables,
  runDatabaseMigration,
} from '@stacksjs/database'
import { path } from '@stacksjs/path'
import { fs, globSync } from '@stacksjs/storage'

/**
 * Resolve the driver at call time off the live `config` proxy.
 *
 * The previous module-level `const driver = database.default || ''`
 * snapshot raced the async config-override loader: `import { database }`
 * is reassigned only when `overridesReady` resolves, so a helper module
 * that evaluates early froze whatever driver happened to be merged at
 * import time. Reading the proxy per call always reflects the merged
 * (and any test-pinned) value.
 */
function currentDriver(): string {
  return config.database?.default || ''
}

// Snapshot path used by the fast SQLite reset path. Initialized lazily
// the first time `refreshDatabase()` runs so test suites that never
// call setup() don't pay any cost. We deliberately co-locate it next
// to the live SQLite file (same directory) so `dropSqliteTables` can't
// accidentally pick it up via a `.sqlite` glob — `.snapshot` extension
// keeps it inert.
let snapshotPath: string | null = null

function getSnapshotPath(): string {
  if (snapshotPath) return snapshotPath
  snapshotPath = `${fetchSqliteFile()}.snapshot`
  return snapshotPath
}

/**
 * Auth/oauth, notification, and RBAC tables live outside the generated
 * model migrations — `buddy migrate` guarantees them as a separate step
 * after `runDatabaseMigration()` (stacksjs/stacks#1948). Test databases
 * need the identical guarantee, or feature tests hit "no such table:
 * oauth_access_tokens" / "no such column: email_verified_at" against a
 * freshly migrated schema. All three migrators are CREATE TABLE IF NOT
 * EXISTS plus defensive ALTERs, so reruns are no-ops. Failures surface
 * on stderr but don't throw — matching `buddy migrate` semantics, so
 * tests that never touch these tables aren't broken by one failed
 * guarantee.
 */
async function migrateFrameworkTables(): Promise<void> {
  const steps = [
    ['auth', migrateAuthTables],
    ['notification', migrateNotificationTables],
    ['RBAC', migrateRbacTables],
  ] as const

  for (const [name, migrateTables] of steps) {
    try {
      const result = await migrateTables()
      if (!result.success)
        console.error(`[testing] Failed to migrate ${name} tables: ${result.error}`)
    }
    catch (error) {
      console.error(`[testing] Failed to migrate ${name} tables:`, error)
    }
  }
}

export async function setupDatabase(): Promise<void> {
  const dbName = `${config.database?.connections?.mysql?.name ?? 'stacks'}_testing`

  if (currentDriver() === 'mysql') {
    await db.unsafe(`CREATE DATABASE IF NOT EXISTS ${dbName}`).execute()
    await runDatabaseMigration()
    await migrateFrameworkTables()
  }
}

export async function refreshDatabase(): Promise<void> {
  await setupDatabase()

  const driver = currentDriver()
  if (driver === 'mysql')
    await truncateMysql()
  if (driver === 'sqlite')
    await truncateSqliteFast()
}

export async function truncateMysql(): Promise<void> {
  const tables = await fetchTables()

  // MySQL refuses TRUNCATE on tables referenced by other tables' foreign
  // keys, so a child→parent table sequence used to fail with a
  // "cannot truncate" error and leave half the schema seeded with stale
  // rows. Disabling FK checks for the duration of the truncate is the
  // standard test-fixture pattern.
  await db.unsafe('SET FOREIGN_KEY_CHECKS = 0').execute()
  try {
    for (const table of tables) {
      await db.unsafe(`TRUNCATE TABLE ${table}`).execute()
    }
  }
  finally {
    await db.unsafe('SET FOREIGN_KEY_CHECKS = 1').execute()
  }
}

export async function truncateSqlite(): Promise<void> {
  const sqlitePath = fetchSqliteFile()

  if (!fs.existsSync(sqlitePath))
    await Bun.$`touch ${sqlitePath}`

  await dropSqliteTables()
  await deleteFrameworkModels()

  const modelFiles = globSync([path.userModelsPath('*.ts'), path.storagePath('framework/defaults/app/Models/**/*.ts')], { absolute: true })

  for (const file of modelFiles) {
    await copyModelFiles(file)
  }

  await runDatabaseMigration()
  // Runs before `truncateSqliteFast()` snapshots the schema, so the
  // fast-restore path keeps the framework tables too.
  await migrateFrameworkTables()
}

/**
 * Snapshot-based SQLite reset. The very first call falls through to the
 * legacy `truncateSqlite()` path (drop, recopy models, migrate) AND
 * captures the resulting empty-but-migrated DB to a `.snapshot` file.
 * Every subsequent call just copies that snapshot back over the live
 * file — orders of magnitude faster than running migrations end to end
 * for each test, and dramatically cheaper than the per-test model file
 * recopy.
 *
 * The snapshot is invalidated automatically when:
 *   - any model file is newer than the snapshot
 *   - any migration file is newer than the snapshot
 *
 * — re-capturing in those cases keeps schema changes correct without
 * the user remembering to clear it.
 */
export async function truncateSqliteFast(): Promise<void> {
  const sqlitePath = fetchSqliteFile()
  const snapPath = getSnapshotPath()

  const snapshotIsStale = (() => {
    if (!fs.existsSync(snapPath)) return true
    const snapMtime = fs.statSync(snapPath).mtimeMs
    const watched = globSync(
      [
        path.userModelsPath('*.ts'),
        path.storagePath('framework/defaults/app/Models/**/*.ts'),
        path.userMigrationsPath('*.ts'),
      ],
      { absolute: true },
    )
    for (const f of watched) {
      try {
        if (fs.statSync(f).mtimeMs > snapMtime) return true
      }
      catch { /* file vanished — ignore */ }
    }
    return false
  })()

  if (snapshotIsStale) {
    // Slow path — same as before, then capture.
    await truncateSqlite()
    try {
      // In WAL mode the freshly migrated schema may still live in the
      // `-wal` sidecar; `copyFileSync` only copies the main DB file, so
      // an un-checkpointed snapshot captures an empty/partial schema
      // that poisons every fast-path restore. Checkpoint first so the
      // main file is complete.
      await db.unsafe('PRAGMA wal_checkpoint(TRUNCATE)').execute()
      fs.copyFileSync(sqlitePath, snapPath)
    }
    catch {
      // If we can't write the snapshot (permissions, full disk, etc.)
      // just continue — the slow path still produced a usable DB.
    }
    return
  }

  // Fast path — restore from snapshot. Copy is single-syscall on every
  // supported OS, so the cost is dominated by the disk size of the empty
  // schema (single-digit ms in practice).
  fs.copyFileSync(snapPath, sqlitePath)
}

/**
 * Wrap each test in a database transaction that rolls back on completion.
 *
 * The fastest possible test isolation: instead of dropping/recopying
 * the schema between tests, every test runs inside `BEGIN; … ROLLBACK;`
 * so the row state at the end of one test is invisible to the next
 * (and to the `--fresh` snapshot path entirely).
 *
 * Caveats — read these before reaching for this helper:
 *   1. Code under test that issues its own `BEGIN`/`COMMIT` will commit
 *      against the outer transaction and the rollback won't undo it
 *      (Postgres doesn't support nested transactions natively).
 *   2. Multi-statement tests that test "commit visibility across
 *      connections" need the slower `refreshDatabase()` path because
 *      the rolled-back transaction never reached the disk.
 *   3. SQLite WAL mode is required for concurrent connections to see
 *      each other within the same DB file; the framework configures
 *      this by default.
 *
 * Use as a `beforeEach`/`afterEach` pair from your test setup:
 *
 * @example
 * ```ts
 * import { beforeEach, afterEach } from 'bun:test'
 * import { useTransactionalTests } from '@stacksjs/testing/database'
 *
 * const tx = useTransactionalTests()
 * beforeEach(tx.begin)
 * afterEach(tx.rollback)
 * ```
 */
export function useTransactionalTests(): {
  begin: () => Promise<void>
  rollback: () => Promise<void>
} {
  let active: { rollback: () => Promise<void> } | null = null
  return {
    begin: async () => {
      // We deliberately don't reuse `db.transaction(fn)` because that
      // closes the transaction synchronously when `fn` returns, but
      // `beforeEach` returns immediately before the test body runs.
      // Instead, run the transaction via raw SQL and stash a rollback
      // callback that the matching `afterEach` calls.
      //
      // Behind the scenes bun-query-builder wraps each statement in
      // its own connection by default; we use a savepoint here to
      // make the rollback safe even when the underlying driver is
      // already inside a transaction (some drivers wrap CLI commands
      // in implicit transactions on connect).
      const savepoint = `stacks_test_${Date.now()}_${Math.floor(Math.random() * 1e6)}`
      await db.unsafe(`SAVEPOINT ${savepoint}`).execute()
      active = {
        rollback: async () => {
          await db.unsafe(`ROLLBACK TO SAVEPOINT ${savepoint}`).execute()
          await db.unsafe(`RELEASE SAVEPOINT ${savepoint}`).execute()
        },
      }
    },
    rollback: async () => {
      if (!active) return
      try {
        await active.rollback()
      }
      finally {
        active = null
      }
    },
  }
}
