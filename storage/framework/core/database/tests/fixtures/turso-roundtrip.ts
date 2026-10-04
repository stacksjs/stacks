/**
 * Child process for `turso.test.ts`: the framework's own `db`, configured for
 * `DB_CONNECTION=turso`, against a live libSQL server named by the parent.
 */
import assert from 'node:assert/strict'

assert.equal(process.env.DB_CONNECTION, 'turso')
const url = process.env.TURSO_DATABASE_URL
assert(url, 'TURSO_DATABASE_URL is required')

const { overridesReady } = await import('@stacksjs/config')
await overridesReady
const { closeDatabaseConnection, db, ensureDatabaseConfigLoaded, getDatabaseDialect, initializeDbConfig } = await import('@stacksjs/database')
const { acquireLibsqlMigrationLock } = await import('../../src/migration-lock')
await ensureDatabaseConfigLoaded()
initializeDbConfig({
  app: { env: 'test' },
  database: { default: 'turso', connections: { turso: { url, authToken: process.env.TURSO_AUTH_TOKEN || undefined } } as never },
})

// Turso renders SQLite SQL.
assert.equal(getDatabaseDialect(), 'sqlite')

const table = `turso_probe_${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`
try {
  await db.unsafe(`CREATE TABLE ${table} (id INTEGER PRIMARY KEY, email TEXT UNIQUE, big INTEGER, data BLOB)`).execute()

  // Builder CRUD on the shared connection.
  await db.insertInto(table).values({ email: 'a@example.com', big: 9223372036854775807n, data: new Uint8Array([1, 2, 255]) }).execute()
  const row = await db.selectFrom(table).where('email', '=', 'a@example.com').first() as Record<string, unknown>
  assert.equal(row.big, 9223372036854775807n, 'integers past 2^53 must not be rounded')
  assert.deepEqual([...(row.data as Uint8Array)], [1, 2, 255])

  // A failed statement mid-transaction rolls back the writes before it.
  await assert.rejects(db.transaction(async (tx) => {
    await tx.insertInto(table).values({ email: 'b@example.com' }).execute()
    await tx.insertInto(table).values({ email: 'a@example.com' }).execute()
  }), (error: { code?: string }) => error.code === 'SQLITE_CONSTRAINT_UNIQUE')
  assert.equal((await db.selectFrom(table).where('email', '=', 'b@example.com').get()).length, 0)

  // And a clean one commits.
  await db.transaction(async (tx) => {
    await tx.insertInto(table).values({ email: 'c@example.com' }).execute()
  })
  assert.equal((await db.selectFrom(table).get()).length, 2)

  // Parallel writes are parallel requests, and all land.
  await Promise.all(Array.from({ length: 20 }, (_, i) => db.insertInto(table).values({ email: `p${i}@example.com` }).execute()))
  assert.equal((await db.selectFrom(table).get()).length, 22)

  // The migration lock lives in the database: a second holder waits.
  const first = await acquireLibsqlMigrationLock(db, { timeoutMs: 2_000 })
  await assert.rejects(acquireLibsqlMigrationLock(db, { timeoutMs: 300 }), /another migration is in progress/)
  await first.release()
  const second = await acquireLibsqlMigrationLock(db, { timeoutMs: 2_000 })
  await second.release()
}
finally {
  await db.unsafe(`DROP TABLE IF EXISTS ${table}`).execute()
  await closeDatabaseConnection()
}
console.log('turso roundtrip ok')
