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

    // Existing rows stay writable, and uuid is now a real unique column.
    db.run(`UPDATE "users" SET "uuid" = 'uuid-' || "id"`)
    db.run(`INSERT INTO "users" ("name", "uuid") VALUES ('new', 'fresh')`)
    assert.throws(() => db.run(`INSERT INTO "users" ("name", "uuid") VALUES ('dup', 'fresh')`), /UNIQUE/)
    assert.deepEqual(db.query('PRAGMA integrity_check').all(), [{ integrity_check: 'ok' }])

    // An index on a column nothing provides is dropped rather than left to
    // block the rename; the model-backed uuid index is kept.
    const userIndexes = (db.query(`SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'users' AND sql IS NOT NULL`).all() as Array<{ name: string }>).map(index => index.name)
    assert(userIndexes.includes('users_users_uuid_unique'))
    assert(!userIndexes.includes('users_users_nickname_index'))
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
