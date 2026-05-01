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
