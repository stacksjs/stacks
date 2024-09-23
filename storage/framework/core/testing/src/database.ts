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

export async function setupDatabase() {
  const dbName = `${database.connections?.mysql?.name ?? 'stacks'}_testing`

  if (driver === 'mysql') {
    await sql`CREATE DATABASE IF NOT EXISTS ${sql.raw(dbName)}`.execute(db)
    //TODO: Remove all log.info
    await runDatabaseMigration()
  }
}

export async function refreshDatabase() {
  await setupDatabase()

  if (driver === 'mysql') await truncateMysql()

  if (driver === 'sqlite') await truncateSqlite()
}

export async function truncateMysql() {
  const tables = await fetchTables()

  for (const table of tables) {
    await sql`TRUNCATE TABLE ${sql.raw(table)}`.execute(db)
  }
}

export async function truncateSqlite() {
  const sqlitePath = fetchSqliteFile()

  if (!fs.existsSync(sqlitePath)) await Bun.$`touch ${sqlitePath}`

  await dropSqliteTables()
  await deleteFrameworkModels()

  const modelFiles = globSync([path.userModelsPath('*.ts')], { absolute: true })

  for (const file of modelFiles) {
    await copyModelFiles(file)
  }

  await runDatabaseMigration()
}
