/**
 * Deleting a user from the dashboard, against real SQLite with its foreign
 * keys on and the real erasure engine (stacksjs/stacks#3253): a user nothing
 * points at is deleted, and one other records still point at is anonymized
 * with those records kept.
 *
 * Its own process because the ORM reads its database once, at first import.
 * Spawned by dashboard-user-delete.test.ts.
 */
import assert from 'node:assert/strict'

const database = process.env.DB_DATABASE_PATH
assert(database)

const { overridesReady } = await import('@stacksjs/config')
await overridesReady.catch(() => undefined)
const { db, ensureDatabaseConfigLoaded, initializeDbConfig, sqlDateTime } = await import('@stacksjs/database/runtime')
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test' }, database: { default: 'sqlite', connections: { sqlite: { database } }, queryLogging: { enabled: false } } })
const { configureOrm } = await import('bun-query-builder')
configureOrm({ database })
const { anonymizedRows, ormReady, personalColumns, User } = await import('@stacksjs/orm')
await ormReady
const { ensureFrameworkAuthTables } = await import('../../../storage/framework/core/auth/tests/helpers/auth-schema')

await db.unsafe('PRAGMA foreign_keys = ON').execute()
await db.unsafe(`CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT, uuid TEXT, name VARCHAR(100) NOT NULL, email VARCHAR(255) NOT NULL UNIQUE,
  password TEXT NOT NULL, avatar TEXT, email_verified_at TIMESTAMP, password_changed_at TIMESTAMP,
  two_factor_secret TEXT, two_factor_enabled INTEGER DEFAULT 0, two_factor_last_used_step INTEGER, stripe_id TEXT,
  created_at TIMESTAMP, updated_at TIMESTAMP
)`).execute()
// A table the erasure rules do not mention, the way an app's own tables are:
// its rows keep pointing at the user whatever erasure does.
await db.unsafe(`CREATE TABLE invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id), total INTEGER NOT NULL
)`).execute()
await db.unsafe(`CREATE TABLE gdpr_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT, uuid TEXT, type TEXT NOT NULL, subject_id INTEGER, actor TEXT, status TEXT,
  summary TEXT, occurred_at TIMESTAMP, created_at TIMESTAMP, updated_at TIMESTAMP
)`).execute()
await ensureFrameworkAuthTables()

const now = sqlDateTime()
await db.insertInto('users').values([
  { id: 1, name: 'Ava Stone', email: 'ava@example.com', password: 'hash-1', avatar: 'https://example.com/ava.png', created_at: now },
  { id: 2, name: 'Donald Kelly', email: 'donald@example.com', password: 'hash-2', avatar: 'https://example.com/donald.png', created_at: now },
  { id: 3, name: 'Grace Hopper', email: 'grace@example.com', password: 'hash-3', created_at: now },
] as never).execute()
await db.insertInto('invoices').values([{ user_id: 2, total: 4200 }, { user_id: 2, total: 900 }] as never).execute()

// The server injects models as globals; the dashboard resolves them there.
;(globalThis as Record<string, unknown>).User = User
const actions = '../../../storage/framework/defaults/app/Actions/Dashboard'
const { default: ModelDestroyAction } = await import(`${actions}/Models/ModelDestroyAction`)
const { default: UserIndexAction } = await import(`${actions}/Data/UserIndexAction`)
const { default: ModelShowAction } = await import(`${actions}/Models/ModelShowAction`)

async function destroy(id: number, viewer: unknown = null): Promise<{ status: number, body: any }> {
  const result = await ModelDestroyAction.handle({
    getParam: (key: string) => ({ slug: 'user', id: String(id) } as Record<string, string>)[key],
    all: () => ({}),
    user: async () => viewer,
  } as any)
  return result instanceof Response ? { status: result.status, body: await result.json() } : { status: 200, body: result }
}
const user = async (id: number) => (await db.selectFrom('users').selectAll().where('id', '=', id).executeTakeFirst()) as Record<string, any> | undefined
const audits = async () => (await db.selectFrom('gdpr_requests').selectAll().orderBy('id', 'asc').execute()) as Array<Record<string, any>>

// 1. Nothing points at Ava: she is deleted, and that is all.
assert.deepEqual(await destroy(1), { status: 200, body: { ok: true, id: 1, anonymized: false } })
assert.equal(await user(1), undefined)
assert.deepEqual(await audits(), [], 'a plain delete is not an erasure')
console.log('PASS a user nothing refers to is deleted')

// 2. Two invoices point at Donald: he is anonymized and they are kept.
assert.deepEqual(await destroy(2, { id: 3 }), { status: 200, body: { ok: true, id: 2, anonymized: true } })
const donald = await user(2)
assert(donald, 'the account is still there')
assert.equal(donald.name, '[erased]')
assert.equal(donald.email, 'erased-2')
assert.equal(donald.avatar, null)
assert.equal(donald.password, '[erased]', 'no password can match it again')
const invoices = await db.selectFrom('invoices').selectAll().where('user_id', '=', 2).execute() as Array<Record<string, any>>
assert.deepEqual(invoices.map(row => Number(row.total)).sort((a, b) => a - b), [900, 4200], 'the records that refer to him are kept')
const [audit] = await audits()
assert.equal(audit!.type, 'erasure')
assert.equal(Number(audit!.subject_id), 2)
assert.equal(audit!.actor, 'dashboard:user:3', 'recorded against the admin who asked')
console.log('PASS a user other records refer to is anonymized, and the records are kept')

// 3. The engine can say which accounts are anonymized, from the columns a list carries.
const listed = (await db.selectFrom('users').select(['id', 'name', 'email', 'avatar']).orderBy('id', 'asc').execute()) as Array<Record<string, any>>
assert.deepEqual(listed.map(row => row.id), [2, 3])
assert.deepEqual(await anonymizedRows('User', listed), [true, false])
assert.deepEqual(await anonymizedRows('User', [{ id: 3 }]), [false], 'a row with no personal column says nothing')
assert.deepEqual(await anonymizedRows('NoSuchModel', listed), [false, false])
// ...and the Users page is told.
const page = await UserIndexAction.handle({ get: () => undefined } as any) as { users: Array<Record<string, any>> }
assert.deepEqual(page.users.map(row => [row.id, row.anonymized]).sort(), [[2, true], [3, false]])
// ...and so is the record's own page, through the generic model endpoint.
const shown = await ModelShowAction.handle({
  getParam: (key: string) => ({ slug: 'user' } as Record<string, string>)[key],
  get: (_key: string, fallback?: unknown) => fallback,
  all: () => ({}),
  query: {},
} as any) as { rows: Array<Record<string, any>>, anonymizedIds?: unknown[], anonymizedColumns?: string[] }
assert.deepEqual(shown.rows.map(row => Number(row.id)).sort(), [2, 3])
assert.deepEqual(shown.anonymizedIds?.map(Number), [2])
// ...with the columns erasure emptied, so the list can say "removed" where
// the row stores a placeholder (stacksjs/stacks#3277). Only ones it is sent:
// the password is personal too, and hidden.
assert.deepEqual(shown.anonymizedColumns?.sort(), ['avatar', 'email', 'name'])
assert.deepEqual((await personalColumns('User')).sort(), ['avatar', 'email', 'name', 'password'])
assert.deepEqual(await personalColumns('NoSuchModel'), [])
// The Users page lists through that endpoint now, and asks its own for the
// numbers alone: no rows are read for it.
const numbers = await UserIndexAction.handle({ get: (key: string) => (key === 'only' ? 'stats' : undefined) } as any) as { users: unknown[], stats: Record<string, number> }
assert.deepEqual(numbers.users, [])
assert.equal(numbers.stats.total, 2)
assert.equal(page.users.length, 2, 'asked without it, the rows still come')
console.log('PASS the list knows an anonymized account from a live one')

// 4. Pressing delete on him again changes nothing and fails nothing.
assert.deepEqual(await destroy(2), { status: 200, body: { ok: true, id: 2, anonymized: true } })
assert.deepEqual(await user(2), donald)
console.log('PASS anonymizing again is harmless')

// 5. Given a real name and address again, it is an account again.
await db.updateTable('users').set({ name: 'Donald Kelly', email: 'donald@example.com' } as never).where('id', '=', 2).execute()
assert.deepEqual(await anonymizedRows('User', [(await user(2))!]), [false])
console.log('PASS an account given its details back is no longer listed as anonymized')

// 6. The guard on deleting yourself comes first, linked records or not.
const own = await destroy(3, { id: 3 })
assert.equal(own.status, 409)
assert.equal((await user(3))!.name, 'Grace Hopper')
console.log('PASS the signed-in account is still protected')

console.log('user delete OK')
process.exit(0)
