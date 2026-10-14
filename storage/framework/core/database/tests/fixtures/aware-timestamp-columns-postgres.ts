/**
 * An aware timestamp column on a framework table: found, reported, and only
 * converted when asked (stacksjs/stacks#2902).
 *
 * Runs against a scratch database whose TimeZone the caller pinned away from
 * UTC, so the shift the framework's naive literal suffers in an aware column
 * is deterministic rather than dependent on the server's default.
 *
 * Prints `aware timestamp columns OK` on success.
 */
import assert from 'node:assert/strict'
import process from 'node:process'

const { DB_HOST: host, DB_DATABASE: name, DB_USERNAME: username, DB_PASSWORD: password, DB_PORT: port } = process.env
assert.equal(process.env.DB_CONNECTION, 'postgres')
assert(name?.startsWith('stacks_aware_timestamps_'))
assert(host && ['127.0.0.1', 'localhost', '[::1]'].includes(host))

const { overridesReady } = await import('@stacksjs/config')
await overridesReady
const { db, ensureDatabaseConfigLoaded, initializeDbConfig } = await import('../../src/utils')
const { AWARE_TIMESTAMP_CONVERSION_ENV, ensureUtcDatetimeColumns, findAwareTimestampColumns } = await import('../../src/datetime-columns')
const { migrateAuthTables } = await import('../../src/auth-tables')

await ensureDatabaseConfigLoaded()
initializeDbConfig({
  app: { env: 'test' },
  database: { default: 'postgres', connections: { postgres: { name, host, port: Number(port || 5432), username, password } }, queryLogging: { enabled: false } },
} as any)

const columnType = async (): Promise<string> => {
  const rows = await db.unsafe(`SELECT data_type FROM information_schema.columns WHERE table_name = 'oauth_access_tokens' AND column_name = 'expires_at'`).execute() as Array<{ data_type: string }>
  return rows[0]!.data_type
}

const auth = await migrateAuthTables()
assert.equal(auth.success, true, String(auth.error))

// The framework's own schema is naive, so there is nothing to report.
assert.equal(await columnType(), 'timestamp without time zone')
assert.deepEqual(await findAwareTimestampColumns(), [])

const zone = (await db.unsafe(`SELECT current_setting('TimeZone') AS tz`).execute() as Array<{ tz: string }>)[0]!.tz
assert.notEqual(zone, 'UTC', 'the caller pins a non-UTC zone so the shift is deterministic')

// The violation an older corpus or a hand-written migration leaves behind.
await db.unsafe(`ALTER TABLE oauth_access_tokens ALTER COLUMN expires_at TYPE timestamptz`).execute()
assert.deepEqual(await findAwareTimestampColumns(), [{ table: 'oauth_access_tokens', column: 'expires_at' }])

// What the framework writes, and what the aware column makes of it.
const { sqlDateTime } = await import('../../src/sql-helpers')
const intended = new Date('2026-10-14T12:00:00.000Z')
const written = sqlDateTime(intended)
await db.unsafe(`INSERT INTO oauth_access_tokens (tokenable_type, tokenable_id, user_id, oauth_client_id, token, name, scopes, revoked, expires_at, created_at, updated_at)
  VALUES ('User', 1, 1, 1, 'aware-probe', 'probe', '[]', false, $1, $2, $2)`, [written, written]).execute()

const storedInstant = async (): Promise<Date> => {
  const rows = await db.unsafe(`SELECT expires_at FROM oauth_access_tokens WHERE token = 'aware-probe'`).execute() as Array<{ expires_at: Date }>
  return rows[0]!.expires_at
}

const shifted = await storedInstant()
assert.notEqual(shifted.getTime(), intended.getTime(), 'an aware column shifts the naive literal by the session offset')

// Default: reported, never altered.
delete process.env[AWARE_TIMESTAMP_CONVERSION_ENV]
const reported = await ensureUtcDatetimeColumns()
assert.deepEqual(reported, { success: true, converted: 0 })
assert.equal(await columnType(), 'timestamp with time zone', 'the report must not run DDL')

// Asked for: converted, and the value the application wrote comes back.
process.env[AWARE_TIMESTAMP_CONVERSION_ENV] = '1'
const converted = await ensureUtcDatetimeColumns()
assert.deepEqual(converted, { success: true, converted: 1 })
assert.equal(await columnType(), 'timestamp without time zone')
assert.equal((await storedInstant()).getTime(), intended.getTime(), 'the cast reads back through the session zone, undoing the write')

// Idempotent: nothing left to find or convert.
assert.deepEqual(await findAwareTimestampColumns(), [])
assert.deepEqual(await ensureUtcDatetimeColumns(), { success: true, converted: 0 })

console.log('aware timestamp columns OK')
process.exit(0)
