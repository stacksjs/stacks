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
    await sql`CREATE DATABASE IF NOT EXISTS ${sql.raw(dbName)}`.execute(db)
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

  for (const table of tables) {
    await sql`TRUNCATE TABLE ${sql.raw(table)}`.execute(db)
  }
}

export async function truncateSqlite(): Promise<void> {
  const sqlitePath = fetchSqliteFile()

  if (!fs.existsSync(sqlitePath))
    await Bun.$`touch ${sqlitePath}`

  await dropSqliteTables()
  await deleteFrameworkModels()

  const modelFiles = globSync([path.userModelsPath('*.ts'), path.storagePath('framework/defaults/models/**/*.ts')], { absolute: true })

  for (const file of modelFiles) {
    await copyModelFiles(file)
  }

  await runDatabaseMigration()
}
