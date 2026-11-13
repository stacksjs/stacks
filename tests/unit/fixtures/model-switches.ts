/**
 * An account's confirmed email and two-factor as switches on its edit form
 * (stacksjs/stacks#3298), through a real server against real SQLite: the
 * form is told about them, a save turns them through the auth package's own
 * functions, and a switch that cannot be turned one way refuses the save.
 *
 * Its own process because the ORM reads its database once, at first import.
 * Spawned by dashboard-model-switches.test.ts.
 */
import assert from 'node:assert/strict'
import process from 'node:process'

const database = process.env.DB_DATABASE_PATH
assert(database && database.includes('stacks-model-switches-'))

const { overridesReady } = await import('@stacksjs/config')
await overridesReady.catch(() => undefined)
const { db, ensureDatabaseConfigLoaded, initializeDbConfig, sqlDateTime } = await import('@stacksjs/database/runtime')
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test' }, database: { default: 'sqlite', connections: { sqlite: { database } }, queryLogging: { enabled: false } } })
const { configureOrm } = await import('bun-query-builder')
configureOrm({ database })
const { ormReady, User } = await import('@stacksjs/orm')
await ormReady
const { ensureFrameworkAuthTables } = await import('../../../storage/framework/core/auth/tests/helpers/auth-schema')
const { route } = await import('@stacksjs/router')

await db.unsafe(`CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT, uuid TEXT, name VARCHAR(100) NOT NULL, email VARCHAR(255) NOT NULL UNIQUE,
  password TEXT NOT NULL, avatar TEXT, email_verified_at TIMESTAMP, password_changed_at TIMESTAMP,
  two_factor_secret TEXT, two_factor_enabled INTEGER DEFAULT 0, two_factor_last_used_step INTEGER, stripe_id TEXT,
  created_at TIMESTAMP, updated_at TIMESTAMP
)`).execute()
await db.unsafe(`CREATE TABLE gdpr_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT, uuid TEXT, type TEXT NOT NULL, subject_id INTEGER, actor TEXT, status TEXT,
  summary TEXT, occurred_at TIMESTAMP, created_at TIMESTAMP, updated_at TIMESTAMP
)`).execute()
await ensureFrameworkAuthTables()
await db.insertInto('users').values([
  { id: 1, name: 'Ava Stone', email: 'ava@example.com', password: 'h', created_at: sqlDateTime() },
  // Signs in with two-factor, and has recovery codes.
  { id: 2, name: 'Ben Hale', email: 'ben@example.com', password: 'h', two_factor_secret: 'JBSWY3DPEHPK3PXP', two_factor_enabled: 1, two_factor_last_used_step: 7, created_at: sqlDateTime() },
] as never).execute()
await db.insertInto('two_factor_recovery_codes').values([
  { user_id: 2, code_hash: 'a'.repeat(64), secret_digest: 'b'.repeat(64) },
  { user_id: 2, code_hash: 'c'.repeat(64), secret_digest: 'b'.repeat(64) },
] as never).execute()

// The server injects models as globals; the dashboard resolves them there.
;(globalThis as Record<string, unknown>).User = User

const actions = 'Actions/Dashboard/Models'
route.get('/api/dashboard/models/{slug}', `${actions}/ModelShowAction`)
route.patch('/api/dashboard/models/{slug}/{id}', `${actions}/ModelUpdateAction`).skipCsrf()
const server: any = await route.serve({ port: 0, hostname: '127.0.0.1' })
const origin = `http://127.0.0.1:${Number(server?.port ?? server?.server?.port)}`

async function save(id: number, fields: Record<string, unknown>): Promise<{ status: number, body: any }> {
  const response = await fetch(`${origin}/api/dashboard/models/user/${id}`, { method: 'PATCH', headers: { 'accept': 'application/json', 'content-type': 'application/json' }, body: JSON.stringify({ fields }) })
  const body = await response.json().catch(() => null)
  if (body && typeof body === 'object')
    delete body.request_id
  return { status: response.status, body }
}
async function stored(id: number): Promise<Record<string, any>> {
  return await db.selectFrom('users').select(['name', 'email_verified_at', 'two_factor_secret', 'two_factor_enabled', 'two_factor_last_used_step'] as never).where('id', '=', id).executeTakeFirst() as Record<string, any>
}
const codes = async (): Promise<number> => ((await db.selectFrom('two_factor_recovery_codes').select(['user_id'] as never).where('user_id', '=', 2).execute()) as unknown[]).length

// 1. The edit form is told about both, and that they are asked for, not only shown.
const shown = await (await fetch(`${origin}/api/dashboard/models/user`, { headers: { accept: 'application/json' } })).json() as { updateFields: Array<Record<string, any>>, createFields: Array<Record<string, any>>, updateColumns: string[] }
const field = (name: string) => shown.updateFields.find(entry => entry.name === name)!
assert.deepEqual([field('emailVerifiedAt').type, field('emailVerifiedAt').label, field('emailVerifiedAt').switch], ['boolean', 'Email Verified', {}])
assert.equal(field('twoFactorEnabled').type, 'boolean')
assert.equal(field('twoFactorEnabled').switch.only, 'off')
assert.match(field('twoFactorEnabled').switch.lockedHelp, /Only the account holder/)
assert(shown.updateColumns.includes('email_verified_at') && shown.updateColumns.includes('two_factor_enabled'))
// A new account has neither to turn: the create form does not ask.
assert.equal(shown.createFields.some(entry => entry.switch), false)
// After the model's own fields, in the order a support request arrives.
assert.deepEqual(shown.updateFields.slice(-2).map(entry => entry.name), ['emailVerifiedAt', 'twoFactorEnabled'])
console.log('PASS the edit form is told about the switches')

// 2. Email verified: on stamps the moment, off clears it, by field or by column.
assert.equal((await stored(1)).email_verified_at, null)
assert.deepEqual(await save(1, { emailVerifiedAt: true }), { status: 200, body: { ok: true, id: 1, changed: ['email_verified_at'] } })
assert.match(String((await stored(1)).email_verified_at), /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/, 'the moment, as the database\'s dialect writes one')
// Asked again: nothing to change, and not a mistake.
const stamped = (await stored(1)).email_verified_at
assert.deepEqual(await save(1, { emailVerifiedAt: true }), { status: 200, body: { ok: true, id: 1, changed: [] } })
assert.equal((await stored(1)).email_verified_at, stamped, 'the moment it was confirmed is kept')
assert.deepEqual(await save(1, { email_verified_at: false }), { status: 200, body: { ok: true, id: 1, changed: ['email_verified_at'] } })
assert.equal((await stored(1)).email_verified_at, null)
console.log('PASS a confirmed email is turned on and off')

// 3. A value that is not a yes or a no is refused, not read as "off".
await save(1, { emailVerifiedAt: true })
const dated = await save(1, { email_verified_at: '2020-01-01 00:00:00' })
assert.equal(dated.status, 422)
assert.deepEqual(dated.body.errors, { emailVerifiedAt: ['Email Verified is on or off.'] })
assert.notEqual((await stored(1)).email_verified_at, null, 'still confirmed')
console.log('PASS a switch is never guessed at')

// 4. Two-factor cannot be turned on from here, and the refusal stops the whole save.
const forced = await save(1, { twoFactorEnabled: true, name: 'Renamed' })
assert.equal(forced.status, 422)
assert.deepEqual(Object.keys(forced.body.errors), ['twoFactorEnabled'])
assert.match(forced.body.errors.twoFactorEnabled[0], /Only the account holder/)
const untouched = await stored(1)
assert.equal(untouched.name, 'Ava Stone', 'nothing was written')
assert.equal(Number(untouched.two_factor_enabled), 0)
console.log('PASS two-factor is never turned on by an operator')

// 5. Turned off, with the rest of the form: the secret, the step and the recovery codes go too.
assert.equal(await codes(), 2)
assert.deepEqual(await save(2, { twoFactorEnabled: false, name: 'Ben H.' }), { status: 200, body: { ok: true, id: 2, changed: ['name', 'two_factor_enabled'] } })
const ben = await stored(2)
assert.deepEqual([ben.name, Number(ben.two_factor_enabled), ben.two_factor_secret, ben.two_factor_last_used_step], ['Ben H.', 0, null, null])
assert.equal(await codes(), 0, 'recovery codes are revoked')
// Already off: asking again is not a mistake, and asking for on is still refused.
assert.deepEqual(await save(2, { twoFactorEnabled: false }), { status: 200, body: { ok: true, id: 2, changed: [] } })
assert.equal((await save(2, { twoFactorEnabled: true })).status, 422)
console.log('PASS two-factor is turned off through the auth package')

// 6. A save with nothing the form can write is still refused, switches or not.
assert.equal((await save(1, { password: 'x' })).status, 422)
assert.equal((await save(99, { emailVerifiedAt: true })).status, 404)

server?.stop?.(true)
console.log('model switches OK')
process.exit(0)
