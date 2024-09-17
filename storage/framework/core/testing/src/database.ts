import { database } from '@stacksjs/config'
import { db, fetchTables, fetchTestSqliteFile, runDatabaseMigration, sql } from '@stacksjs/database'

const driver = database.default || ''

export async function setupDatabase() {
  const dbName = `${database.connections?.mysql?.name ?? 'stacks'}_testing`

  if (driver === 'mysql') {
    await sql`CREATE DATABASE IF NOT EXISTS ${sql.raw(dbName)}`.execute(db)

    await runDatabaseMigration()
  }
}

export async function refreshDatabase() {
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
  const dbPath = await fetchTestSqliteFile()

  if (fs.existsSync(dbPath)) await Bun.$`rm ${dbPath}`

  await runDatabaseMigration()
}
