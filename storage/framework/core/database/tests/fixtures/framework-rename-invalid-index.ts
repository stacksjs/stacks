import assert from 'node:assert/strict'
import { Database } from 'bun:sqlite'
import process from 'node:process'

const databasePath = process.env.DB_DATABASE_PATH
assert(databasePath, 'the fixture requires a disposable SQLite path')

const { resetDatabaseConnection, runDatabaseMigration } = await import('../../src')

try {
  const result = await runDatabaseMigration()
  assert.equal(result.isErr, false, String(result.error?.message ?? result.error))

  const db = new Database(databasePath)
  try {
    const tables = db.query(`SELECT name FROM sqlite_master WHERE type = 'table'`).all() as Array<{ name: string }>
    const names = tables.map(table => table.name)
    assert(names.includes('couriers'))
    assert(names.includes('courier_pings'))
    assert(!names.includes('drivers'))
    assert(!names.includes('driver_pings'))

    const userColumns = db.query('PRAGMA table_info("users")').all() as Array<{ name: string }>
    assert(userColumns.some(column => column.name === 'uuid'))
    assert.deepEqual(db.query('PRAGMA integrity_check').all(), [{ integrity_check: 'ok' }])
    assert.deepEqual(db.query('PRAGMA foreign_key_check').all(), [])
  }
  finally {
    db.close()
  }

  console.log('framework rename with trait index OK')
}
finally {
  resetDatabaseConnection()
}
