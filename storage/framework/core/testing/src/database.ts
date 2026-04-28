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
    await truncateSqlite()
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
