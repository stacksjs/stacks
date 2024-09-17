import { database } from '@stacksjs/config'
import { db } from '@stacksjs/database'

const driver = database.default || ''

export async function refreshDatabase() {
  if (driver === 'mysql') {
    await refreshMysql()
  }

  if (driver === 'sqlite') {
    await refreshMysql()
  }
}

export async function refreshMysql() {
  const tables = await fetchTables()

  for (const table of tables) {
    await sql`TRUNCATE TABLE ${sql.raw(table)}`.execute(db)
  }
}

export async function refreshSqlite() {
  const dbPath = await fetchTestSqliteFile()

  if (fs.existsSync(dbPath)) await Bun.$`rm ${dbPath}`
}
