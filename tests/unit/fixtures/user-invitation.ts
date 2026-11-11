/**
 * Inviting a user from the dashboard, against real SQLite and the real
 * account-setup link (stacksjs/stacks#3252): the account is created with a
 * password nobody knows, its holder is sent a link, and the link sets the
 * password they choose.
 *
 * Its own process because the ORM and the auth package read their database
 * once, at first import. Spawned by dashboard-user-invitation.test.ts.
 */
import assert from 'node:assert/strict'

const database = process.env.DB_DATABASE_PATH
assert(database)

const { overridesReady } = await import('@stacksjs/config')
await overridesReady.catch(() => undefined)
const { db, ensureDatabaseConfigLoaded, initializeDbConfig, parseSqlDateTime, sqlDateTime } = await import('@stacksjs/database/runtime')
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test' }, database: { default: 'sqlite', connections: { sqlite: { database } }, queryLogging: { enabled: false } } })
const { configureOrm } = await import('bun-query-builder')
configureOrm({ database })
const { ormReady, User } = await import('@stacksjs/orm')
await ormReady
const { verifyHash } = await import('@stacksjs/security')
const { findAuthUserRowByEmail, passwordResets } = await import('@stacksjs/auth')
const { ensureFrameworkAuthTables } = await import('../../../storage/framework/core/auth/tests/helpers/auth-schema')
const { inviteUser, USER_INVITATION_DAYS } = await import('../../../storage/framework/defaults/app/Actions/Dashboard/Users/user-invitation')

await db.unsafe(`CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT, uuid TEXT, name VARCHAR(100) NOT NULL, email VARCHAR(255) NOT NULL UNIQUE,
  password TEXT NOT NULL, avatar TEXT, email_verified_at TIMESTAMP, password_changed_at TIMESTAMP,
  two_factor_secret TEXT, two_factor_enabled INTEGER DEFAULT 0, two_factor_last_used_step INTEGER, stripe_id TEXT,
  created_at TIMESTAMP, updated_at TIMESTAMP
)`).execute()
await ensureFrameworkAuthTables()

interface Delivery { purpose: string, userId: number, email: string, token: string, url: string, expiresAt: Date }
const deliveries: Delivery[] = []

/** The action's own wiring, with the mail caught instead of sent. */
const dependencies = {
  Model: User,
  findUserByEmail: findAuthUserRowByEmail,
  clearSetupLinks: async (email: string) => {
    await db.deleteFrom('password_resets').where('email', '=', email).execute()
  },
  sendSetupLink: (email: string, expiresAt: Date) => passwordResets(email).sendEmail({
    purpose: 'setup',
    expiresAt,
    deliver: delivery => void deliveries.push(delivery as Delivery),
  }),
}

const users = async () => (await db.selectFrom('users').selectAll().orderBy('id', 'asc').execute()) as Array<Record<string, any>>
const links = async (email: string) => (await db.selectFrom('password_resets').selectAll().where('email', '=', email).execute()) as Array<Record<string, any>>

// 1. The invitation creates the account and sends its holder the link.
const invited = await inviteUser({ name: '  Ada Lovelace ', email: ' Ada@Example.com ' }, dependencies)
assert.equal(invited.ok, true, JSON.stringify(invited))
assert(invited.ok)
assert.equal(invited.email, 'ada@example.com')
const [ada] = await users()
assert.equal(ada.name, 'Ada Lovelace')
assert.equal(ada.email, 'ada@example.com')
assert.equal(Number(ada.id), Number(invited.id))
assert.match(ada.password, /^\$2[aby]\$/, 'the placeholder password is stored hashed')
assert.equal(deliveries.length, 1)
const [delivery] = deliveries
assert.equal(delivery!.purpose, 'setup')
assert.equal(delivery!.email, 'ada@example.com')
assert.equal(delivery!.userId, Number(ada.id))
assert.ok(delivery!.url.includes(delivery!.token))
const lifetimeDays = (delivery!.expiresAt.getTime() - Date.now()) / 86_400_000
assert.ok(lifetimeDays > USER_INVITATION_DAYS - 0.01 && lifetimeDays <= USER_INVITATION_DAYS, `the link lasts ${lifetimeDays} days`)
const [link] = await links('ada@example.com')
assert.equal(parseSqlDateTime(link.expires_at)?.getTime(), parseSqlDateTime(sqlDateTime(delivery!.expiresAt))?.getTime())
console.log('PASS creates the account and sends the setup link')

// 2. The link sets the password its holder chooses, once.
const chosen = await passwordResets('ada@example.com').resetPassword(delivery!.token, 'chosen-password-1')
assert.deepEqual(chosen, { success: true })
const [afterSetup] = await users()
assert.equal(await verifyHash('chosen-password-1', afterSetup.password), true)
assert.notEqual(afterSetup.password, ada.password)
const again = await passwordResets('ada@example.com').resetPassword(delivery!.token, 'another-password-2')
assert.equal(again.success, false, 'the link is spent')
console.log('PASS the link sets the chosen password, once')

// 3. An address that already has an account is refused before anything is written.
const duplicate = await inviteUser({ name: 'Ada Again', email: 'ADA@example.com' }, dependencies)
assert.deepEqual(duplicate, { ok: false, reason: 'invalid', errors: { email: ['A user with this email already exists.'] } })
assert.equal((await users()).length, 1)
assert.equal(deliveries.length, 1)
console.log('PASS refuses an address that already has an account')

// 4. A rule the model sets is refused the same way, field by field.
const invalid = await inviteUser({ name: 'A', email: 'not-an-address' }, dependencies)
assert.equal(invalid.ok, false)
assert(!invalid.ok && invalid.reason === 'invalid')
assert.deepEqual(Object.keys(invalid.errors).sort(), ['email', 'name'])
assert.equal((await users()).length, 1)
console.log('PASS refuses what the model refuses')

// 5. An invitation that was not delivered leaves no account behind.
for (const sendSetupLink of [
  async () => { throw new Error('SMTP connection refused') },
  async () => false,
]) {
  const undelivered = await inviteUser({ name: 'Grace Hopper', email: 'grace@example.com' }, { ...dependencies, sendSetupLink })
  assert.equal(undelivered.ok, false)
  assert(!undelivered.ok && undelivered.reason === 'undelivered', JSON.stringify(undelivered))
  assert.equal(await findAuthUserRowByEmail('grace@example.com'), undefined)
  assert.equal((await users()).length, 1)
  assert.deepEqual(await links('grace@example.com'), [])
}
// ...so the retry is not refused as a duplicate, or throttled by the first try.
const retried = await inviteUser({ name: 'Grace Hopper', email: 'grace@example.com' }, dependencies)
assert.equal(retried.ok, true, JSON.stringify(retried))
assert.equal(deliveries.length, 2)
console.log('PASS an undelivered invitation leaves no account, and can be retried')

// 6. A link left by an account that is gone neither blocks the invitation nor survives it.
await db.insertInto('password_resets').values({ email: 'linus@example.com', token: 'left-by-a-deleted-account', created_at: sqlDateTime(), expires_at: sqlDateTime(new Date(Date.now() + 3_600_000)) } as never).execute()
const afterStale = await inviteUser({ name: 'Linus Torvalds', email: 'linus@example.com' }, dependencies)
assert.equal(afterStale.ok, true, JSON.stringify(afterStale))
const linusLinks = await links('linus@example.com')
assert.equal(linusLinks.length, 1)
assert.notEqual(linusLinks[0]!.token, 'left-by-a-deleted-account')
console.log('PASS a stale link is replaced')

// 7. The framework's own mail, as the action sends it: the result says it went.
const mailed = await inviteUser({ name: 'Margaret Hamilton', email: 'margaret@example.com' }, {
  ...dependencies,
  sendSetupLink: (email, expiresAt) => passwordResets(email).sendEmail({ purpose: 'setup', expiresAt }),
})
assert.equal(mailed.ok, true, JSON.stringify(mailed))
// A second link inside the throttle window is not sent, and says so.
assert.equal(await passwordResets('margaret@example.com').sendEmail({ purpose: 'setup' }), false)
assert.equal(await passwordResets('nobody@example.com').sendEmail(), false)
console.log('PASS the default mail reports whether it was sent')

console.log('user invitation OK')
process.exit(0)
