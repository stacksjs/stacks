/**
 * A model's `dashboard.fields`, through the dashboard's own actions against
 * real SQLite (stacksjs/stacks#3266): the list is told each field's
 * heading and format, the forms its label, help and input, and a refused
 * write names the field as the model does.
 *
 * Its own process because the ORM reads its database once, at first import.
 * Spawned by dashboard-model-field-overrides.test.ts.
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
const { ormReady, User } = await import('@stacksjs/orm')
await ormReady
const { ensureFrameworkAuthTables } = await import('../../../storage/framework/core/auth/tests/helpers/auth-schema')

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

const now = sqlDateTime()
await db.insertInto('users').values([
  { id: 1, name: 'Ava Stone', email: 'ava@example.com', password: 'hash-1', avatar: 'https://example.com/ava.png', stripe_id: 'cus_123', created_at: now },
  { id: 2, name: 'Donald Kelly', email: 'donald@example.com', password: 'hash-2', created_at: now },
] as never).execute()

// The server injects models as globals; the dashboard resolves them there.
;(globalThis as Record<string, unknown>).User = User
// What the model ships with, before anything here changes it.
assert.deepEqual((User as any).dashboard.fields, { avatar: { format: 'image' } })
;(User as any).dashboard.fields = {
  name: { label: 'Full name', help: 'As it appears on invoices.' },
  email: { label: 'Work email', input: 'text' },
  avatar: { label: 'Photo', format: 'image' },
  // A column the auth trait adds, which the model's own definition does not list.
  emailVerifiedAt: { label: 'Verified' },
  created_at: { label: 'Joined', format: 'date' },
  stripeId: { format: 'code' },
  // Declared badly, each in its own way.
  nickname: { label: 'Nickname' },
  twoFactorEnabled: { input: 'longtext' },
  twoFactorLastUsedStep: { format: 'cash', label: 'Last step' },
}

const actions = '../../../storage/framework/defaults/app/Actions/Dashboard'
const { default: ModelShowAction } = await import(`${actions}/Models/ModelShowAction`)
const { default: ModelUpdateAction } = await import(`${actions}/Models/ModelUpdateAction`)

const warnings: string[] = []
const warn = console.warn
console.warn = (...parts: unknown[]) => void warnings.push(parts.map(String).join(' '))
const show = async () => await ModelShowAction.handle({
  getParam: (key: string) => ({ slug: 'user' } as Record<string, string>)[key],
  get: (_key: string, fallback?: unknown) => fallback,
  all: () => ({}),
  query: {},
} as any) as { columnMeta: Array<Record<string, any>>, updateFields: Array<Record<string, any>>, listColumns: string[] }
const listed = await show()
await show()
console.warn = warn

// 1. Every page is told the same name for a field, and how its value reads.
const column = (name: string) => listed.columnMeta.find(entry => entry.name === name)!
assert.deepEqual(column('name'), { name: 'name', label: 'Full name', type: 'text' })
assert.deepEqual(column('email'), { name: 'email', label: 'Work email', type: 'text' })
assert.deepEqual(column('avatar'), { name: 'avatar', label: 'Photo', type: 'text', format: { format: 'image' } })
assert.deepEqual(column('email_verified_at'), { name: 'email_verified_at', label: 'Verified', type: 'date' })
assert.deepEqual(column('created_at'), { name: 'created_at', label: 'Joined', type: 'date', format: { format: 'date' } })
assert.deepEqual(column('stripe_id'), { name: 'stripe_id', label: 'Stripe ID', type: 'number', format: { format: 'code' } })
// A setting that cannot be read is dropped on its own: the heading stays.
assert.deepEqual(column('two_factor_last_used_step'), { name: 'two_factor_last_used_step', label: 'Last step', type: 'text' })
// What the model leaves alone stays derived, a moment read as what happened.
assert.equal(column('password_changed_at').label, 'Password Changed')
assert.equal(column('updated_at').label, 'Last Updated')
assert.equal(column('uuid').label, 'UUID')
console.log('PASS the list is told each field\'s heading and format')

// 2. The edit form: the same label, the model's help, the input it asked for.
const field = (name: string) => listed.updateFields.find(entry => entry.name === name)!
assert.equal(field('name').label, 'Full name')
assert.equal(field('name').help, 'As it appears on invoices.')
assert.equal(field('email').label, 'Work email')
assert.equal(field('email').type, 'text', 'an address asked for as a plain line, because the model said so')
assert.equal(field('name').type, 'text')
assert.equal('help' in field('email'), false)
console.log('PASS the form is told each field\'s label, help and input')

// 3. What is declared badly is said once, by name, and changes nothing else.
const said = warnings.filter(line => line.includes('User dashboard.fields'))
assert.deepEqual(said.map(line => line.replace('[dashboard] User dashboard.fields: ', '')).sort(), [
  '\'nickname\' is not a field of the model. It is ignored.',
  '\'twoFactorEnabled\' asks for the \'longtext\' input, but it is not an attribute the forms ask for. It is ignored.',
  '\'twoFactorLastUsedStep\' asks for a format the dashboard does not have: \'cash\' (it has badge, bytes, code, date, datetime, duration, image, link, money, number, percent, text). It is ignored.',
], 'said once though the list was read twice, and a trait\'s column is not called missing')
console.log('PASS a bad declaration is named once')

// 4. A refused write names the field as the model does.
const update = async (id: number, fields: Record<string, unknown>) => {
  const result = await ModelUpdateAction.handle({
    getParam: (key: string) => ({ slug: 'user', id: String(id) } as Record<string, string>)[key],
    all: () => ({ fields }),
    get: (key: string) => (key === 'fields' ? fields : undefined),
    user: async () => null,
  } as any)
  return result instanceof Response ? { status: result.status, body: await result.json() } : { status: 200, body: result }
}
const blank = await update(1, { name: '' })
assert.equal(blank.status, 422, JSON.stringify(blank))
assert.deepEqual(blank.body.errors, { name: ['Full name is required.'] })
const taken = await update(1, { email: 'donald@example.com' })
assert.equal(taken.status, 422, JSON.stringify(taken))
assert.deepEqual(taken.body.errors, { email: ['Work email is already in use.'] })
assert.equal(((await db.selectFrom('users').selectAll().where('id', '=', 1).executeTakeFirst()) as any).email, 'ava@example.com')
console.log('PASS a refused write names the field as the model does')

console.log('field overrides OK')
process.exit(0)
