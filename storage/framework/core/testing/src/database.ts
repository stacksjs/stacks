import { database } from '@stacksjs/config'
import {
  db,
  deleteFrameworkModels,
  fetchSqliteFile,
  fetchTables,
  fetchTestSqliteFile,
  resetSqliteDatabase,
  runDatabaseMigration,
  sql,
} from '@stacksjs/database'
import { fs } from '@stacksjs/storage'

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
  await deleteFrameworkModels()

  await runDatabaseMigration()
}
