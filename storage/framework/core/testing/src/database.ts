import { database } from '@stacksjs/config'
import {
  copyModelFiles,
  db,
  deleteFrameworkModels,
  dropSqliteTables,
  fetchSqliteFile,
  fetchTables,
  runDatabaseMigration,
  sql,
} from '@stacksjs/database'
import { path } from '@stacksjs/path'
import { fs, globSync } from '@stacksjs/storage'

const driver = database.default || ''

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

export async function setupDatabase(): Promise<void> {
  const dbName = `${database.connections?.mysql?.name ?? 'stacks'}_testing`

  if (driver === 'mysql') {
    await (sql`CREATE DATABASE IF NOT EXISTS ${sql.raw(dbName)}` as any).execute(db)
    // TODO: Remove all log.info
    await runDatabaseMigration()
  }
}

export async function refreshDatabase(): Promise<void> {
  await setupDatabase()

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
  await (sql`SET FOREIGN_KEY_CHECKS = 0` as any).execute(db)
  try {
    for (const table of tables) {
      await (sql`TRUNCATE TABLE ${sql.raw(table)}` as any).execute(db)
    }
  }
  finally {
    await (sql`SET FOREIGN_KEY_CHECKS = 1` as any).execute(db)
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
      await (sql`SAVEPOINT ${sql.raw(savepoint)}` as any).execute(db)
      active = {
        rollback: async () => {
          await (sql`ROLLBACK TO SAVEPOINT ${sql.raw(savepoint)}` as any).execute(db)
          await (sql`RELEASE SAVEPOINT ${sql.raw(savepoint)}` as any).execute(db)
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
