/**
 * Runs a real migration from inside a project whose config/database.ts names
 * its own SQLite file, then reads the ledger through the app's `db`. For
 * `migrate-configured-database.test.ts`.
 */
import process from 'node:process'

const database = await import('../../src')
const result = await database.runDatabaseMigration()
const ledger = await database.db.unsafe('SELECT migration FROM migrations').execute() as Array<{ migration: string }>
const file = await database.db.unsafe('PRAGMA database_list').execute() as Array<{ file: string }>

console.log(JSON.stringify({
  ok: result.isOk,
  message: result.isOk ? result.value : result.error.message,
  ledger: ledger.map(row => row.migration),
  appFile: file[0]?.file,
}))
process.exit(0)
