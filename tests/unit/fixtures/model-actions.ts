/**
 * A model's own dashboard actions, through a real server, against real SQLite
 * (stacksjs/stacks#3265): the list says which rows are offered which
 * action, and one route runs whichever the model named, the way that
 * action's own route would.
 *
 * Its own process because the ORM and the auth package read their database
 * once, at first import. Spawned by dashboard-model-actions.test.ts.
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
const { provideActions, route } = await import('@stacksjs/router')
const { schema } = await import('@stacksjs/validation')

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
  { id: 1, name: 'Ava Stone', email: 'ava@example.com', password: 'hash-1', email_verified_at: now, created_at: now },
  { id: 2, name: 'Donald Kelly', email: 'donald@example.com', password: 'hash-2', two_factor_enabled: 1, created_at: now },
  // As erasure leaves an account: placeholders where the person was.
  { id: 3, name: '[erased]', email: 'erased-3', password: '[erased]', created_at: now },
] as never).execute()

// The server injects models as globals; the dashboard resolves them there.
;(globalThis as Record<string, unknown>).User = User

// The two routes the pages use, as the dashboard registers them. CSRF has its
// own tests; what is under test here is what runs once a request is let in.
route.get('/api/dashboard/models/{slug}', 'Actions/Dashboard/Models/ModelShowAction')
route.post('/api/dashboard/models/{dashboardModel}/{id}/actions/{dashboardAction}', 'Actions/Dashboard/Models/ModelActionRunAction').skipCsrf()
const server: any = await route.serve({ port: 0, hostname: '127.0.0.1' })
const origin = `http://127.0.0.1:${Number(server?.port ?? server?.server?.port)}`

interface Listing { actions: Array<Record<string, unknown>>, rowActions: Record<string, string[]> }
async function list(): Promise<Listing> {
  const answer = await fetch(`${origin}/api/dashboard/models/user?sort=id&dir=asc`, { headers: { accept: 'application/json' } })
  assert.equal(answer.status, 200, await answer.clone().text())
  return await answer.json() as Listing
}
async function run(name: string, id: number | string, body: unknown = {}): Promise<{ status: number, body: any }> {
  const answer = await fetch(`${origin}/api/dashboard/models/user/${id}/actions/${name}`, {
    method: 'POST',
    headers: { 'accept': 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const answered = await answer.json().catch(() => null)
  // The router stamps every refusal with the request's id; not what is under test.
  if (answered && typeof answered === 'object')
    delete answered.request_id
  return { status: answer.status, body: answered }
}
const links = async (email: string) => (await db.selectFrom('password_resets').selectAll().where('email', '=', email).execute()) as Array<Record<string, any>>

// 1. The action the User model ships with: the list offers it, and it sends the link.
const shipped = await list()
assert.deepEqual(shipped.actions, [{
  name: 'send-password-reset',
  label: 'Send password reset',
  icon: 'i-hugeicons-reset-password',
  confirm: 'They are emailed a link to choose a new password. Their current password keeps working until they use it.',
  destructive: false,
  places: ['record'],
  fields: [],
}], 'the page is told how to draw the button, and not which file runs or for whom')
assert.deepEqual(shipped.rowActions, { 1: ['send-password-reset'], 2: ['send-password-reset'] }, 'an erased account is offered nothing')

assert.deepEqual(await links('ava@example.com'), [])
const sent = await run('send-password-reset', 1)
assert.deepEqual(sent, { status: 200, body: { ok: true, message: 'ava@example.com was sent a link to choose a new password.', redirect: '' } })
assert.equal((await links('ava@example.com')).length, 1, 'a link was issued for her address')
assert.equal((await links('donald@example.com')).length, 0, 'and for nobody else')
// Pressed again at once: the link is throttled, and the page is told why.
const again = await run('send-password-reset', 1)
assert.equal(again.status, 429)
assert.match(again.body.message, /sent to ava@example\.com moments ago/)
assert.equal((await links('ava@example.com')).length, 1)
console.log('PASS the shipped action runs for the record whose button was pressed')

// 2. What is not offered cannot be run by asking.
assert.deepEqual(await run('send-password-reset', 3), { status: 409, body: { message: 'This user was anonymized, so "Send password reset" has nothing to act on.' } })
assert.deepEqual(await run('send-password-reset', 99), { status: 404, body: { message: 'User 99 not found.' } })
assert.deepEqual(await run('promote', 1), { status: 404, body: { message: 'User has no dashboard action named \'promote\'.' } })
assert.equal((await run('send-password-reset', 'abc')).status, 400)
console.log('PASS an erased, missing or undeclared target is refused')

// 3. An app's own actions, declared on the model: conditions, input, refusals.
const ran: string[] = []
provideActions({
  'Actions/Fixture/RequireTwoFactor': async () => ({
    default: { handle: (request: any) => (ran.push(`require:${request.getParam('id')}`), { message: 'Two-factor is now required.', redirect: '/models/user/1', internal: 'not passed along' }) },
  }),
  'Actions/Fixture/Refuses': async () => ({
    default: { handle: () => { throw Object.assign(new Error('This account is on hold.'), { status: 409 }) } },
  }),
  'Actions/Fixture/Guarded': async () => ({
    default: { authorize: () => false, handle: () => (ran.push('guarded'), {}) },
  }),
  'Actions/Fixture/NeedsReason': async () => ({
    default: {
      validations: { reason: { rule: schema.string().required().min(3), message: 'Say why.' } },
      handle: (request: any) => (ran.push(`reason:${request.get('reason')}`), undefined),
    },
  }),
  // Takes input of every kind a form can ask for, and validates the record's id.
  'Actions/Fixture/Refund': async () => ({
    default: {
      validations: {
        id: { rule: schema.number().required() },
        reason: { rule: schema.string().required().min(3), message: 'Say why.' },
        amount: { rule: schema.number().min(1) },
        restock: { rule: schema.boolean() },
        method: { rule: schema.enum(['card', 'credit']).required() },
        attachments: { rule: schema.array() },
      },
      handle: (request: any) => (ran.push(`refund:${request.getParam('id')}:${JSON.stringify({ reason: request.get('reason'), amount: request.get('amount'), restock: request.get('restock'), method: request.get('method') })}`), { message: 'Refunded.' }),
    },
  }),
  // Requires what no form can give.
  'Actions/Fixture/Import': async () => ({
    default: { validations: { rows: { rule: schema.array().required() } }, handle: () => (ran.push('import'), {}) },
  }),
  'Actions/Fixture/Elsewhere': async () => ({
    default: { handle: () => ({ redirect: 'https://example.com/phish' }) },
  }),
})
const declared = (User as any).dashboard.actions
const warnings: string[] = []
const warn = console.warn
console.warn = (...parts: unknown[]) => void warnings.push(parts.map(String).join(' '))
;(User as any).dashboard.actions = [
  // Only for accounts that have two-factor on, by a column the page is never sent.
  { name: 'requireTwoFactor', action: 'Actions/Fixture/RequireTwoFactor', when: { twoFactorEnabled: true }, on: ['record'] },
  { name: 'unverified-only', action: 'Actions/Fixture/RequireTwoFactor', when: { emailVerifiedAt: null } },
  { name: 'refuses', action: 'Actions/Fixture/Refuses', destructive: true },
  { name: 'guarded', action: 'Actions/Fixture/Guarded' },
  // Offered for a selection only. It is still run one record at a time.
  { name: 'needs-reason', action: 'Actions/Fixture/NeedsReason', on: ['bulk'] },
  { name: 'elsewhere', action: 'Actions/Fixture/Elsewhere' },
  { name: 'refund', action: 'Actions/Fixture/Refund', on: ['record'], fields: { reason: { label: 'Reason for the refund', input: 'longtext', help: 'Shown to the customer.' }, amount: { input: 'longtext' }, nonsense: { label: 'Nope' } } },
  { name: 'import', action: 'Actions/Fixture/Import' },
  // Declared badly, each in its own way: none of these may become a button.
  { name: 'gone', action: 'Actions/Fixture/WasRenamed' },
  { name: 'no handler' },
  { name: 'refuses', action: 'Actions/Fixture/Refuses' },
  { name: 'controller', action: 'Controllers/UserController@promote' },
  { name: 'unreadable', action: 'Actions/Fixture/Refuses', when: 'verified' },
  { name: 'nowhere', action: 'Actions/Fixture/Refuses', on: ['toolbar'] },
]

const custom = await list()
console.warn = warn
assert.deepEqual(custom.actions.map(action => [action.name, action.label, action.places, action.destructive]), [
  ['requireTwoFactor', 'Require two factor', ['record'], false],
  ['unverified-only', 'Unverified only', ['record', 'row'], false],
  ['refuses', 'Refuses', ['record', 'row'], true],
  ['guarded', 'Guarded', ['record', 'row'], false],
  ['needs-reason', 'Needs reason', ['bulk'], false],
  ['elsewhere', 'Elsewhere', ['record', 'row'], false],
  ['refund', 'Refund', ['record'], false],
])
const always = ['refuses', 'guarded', 'needs-reason', 'elsewhere', 'refund']
assert.deepEqual(custom.rowActions, {
  1: always,
  2: ['requireTwoFactor', 'unverified-only', ...always],
}, 'each row is offered what its own values allow')
for (const name of ['gone', 'no handler', 'refuses', 'controller', 'unreadable', 'nowhere', 'import'])
  assert(warnings.some(line => line.includes('User dashboard.actions') && line.includes(`'${name}'`)), `${name} is said by name: ${warnings.join(' | ')}`)
assert(warnings.some(line => line.includes('Actions/Fixture/WasRenamed') && line.includes('could not be loaded')))
// Said once, not on every page load.
console.warn = (...parts: unknown[]) => void warnings.push(parts.map(String).join(' '))
const before = warnings.length
await list()
console.warn = warn
assert.equal(warnings.length, before)
console.log('PASS the list offers each row what applies, and bad declarations are named once')

assert.deepEqual(await run('requireTwoFactor', 2), { status: 200, body: { ok: true, message: 'Two-factor is now required.', redirect: '/models/user/1' } })
assert.deepEqual(ran, ['require:2'])
// Ava has two-factor off: no button, and no way around the missing button.
assert.deepEqual(await run('requireTwoFactor', 1), { status: 409, body: { message: '"Require two factor" is not available for this user as it is now.' } })
assert.deepEqual(await run('unverified-only', 1), { status: 409, body: { message: '"Unverified only" is not available for this user as it is now.' } })
assert.deepEqual(ran, ['require:2'])
for (const name of ['gone', 'controller', 'unreadable', 'nowhere'])
  assert.equal((await run(name, 2)).status, 404, `${name} is not an action`)
console.log('PASS a condition is enforced when the action is run, not only when the button is drawn')

const refused = await run('refuses', 1)
assert.equal(refused.status, 409)
assert.equal(refused.body.message, 'This account is on hold.')
const guarded = await run('guarded', 1)
assert.equal(guarded.status, 403)
assert(!ran.includes('guarded'))
const invalid = await run('needs-reason', 1)
assert.equal(invalid.status, 422)
assert.match(JSON.stringify(invalid.body), /Say why\./)
assert.deepEqual(await run('needs-reason', 1, { reason: 'requested by phone' }), { status: 200, body: { ok: true, message: '', redirect: '' } })
assert(ran.includes('reason:requested by phone'))
assert.deepEqual((await run('elsewhere', 1)).body, { ok: true, message: '', redirect: '' }, 'an address outside the dashboard is not followed')
console.log('PASS the action runs as its own route would: authorize, validations, and its own refusals')

// 4. An action that takes input is asked for it: the form is its own validations.
const form = (name: string) => (custom.actions.find(action => action.name === name)!.fields as Array<Record<string, unknown>>)
assert.deepEqual(form('refund'), [
  // The model's own words for it, and the box it asked for.
  { name: 'reason', label: 'Reason for the refund', type: 'longtext', required: true, defaultValue: '', options: [], help: 'Shown to the customer.' },
  // A number stays a number: another input is only another way to type text.
  { name: 'amount', label: 'Amount', type: 'number', required: false, defaultValue: '', options: [] },
  { name: 'restock', label: 'Restock', type: 'boolean', required: false, defaultValue: false, options: [] },
  { name: 'method', label: 'Method', type: 'enum', required: true, defaultValue: '', options: ['card', 'credit'] },
], 'never the record\'s id, and never an optional list')
assert.deepEqual(form('needs-reason').map(field => [field.name, field.type, field.required]), [['reason', 'text', true]])
assert.deepEqual(form('elsewhere'), [], 'an action that takes nothing has no form')
assert(warnings.some(line => line.includes('\'import\' runs Actions/Fixture/Import, which requires \'rows\': a value a form cannot give')), warnings.join(' | '))
assert(warnings.some(line => line.includes('\'refund\' describes a field \'nonsense\' that the action does not take')), warnings.join(' | '))
assert(warnings.some(line => line.includes('\'refund\' field \'amount\' asks for the \'longtext\' input, but it is not a field of text (it is asked for as number)')), warnings.join(' | '))
assert.equal((await run('import', 1)).status, 404, 'what is left out cannot be run by asking')
// What the form sends is what the action receives, as its own route would.
assert.deepEqual(await run('refund', 2, { reason: 'Arrived damaged', amount: 1200, restock: true, method: 'credit' }), { status: 200, body: { ok: true, message: 'Refunded.', redirect: '' } })
assert(ran.includes('refund:2:{"reason":"Arrived damaged","amount":1200,"restock":true,"method":"credit"}'), ran.join(' | '))
// And a refusal names the field, in the action's own words.
const unanswered = await run('refund', 2, { method: 'cash' })
assert.equal(unanswered.status, 422)
assert.deepEqual(Object.keys(unanswered.body.errors).sort(), ['method', 'reason'])
assert.deepEqual(unanswered.body.errors.reason, ['Say why.'])
assert.equal(ran.filter(entry => entry.startsWith('refund:')).length, 1)
console.log('PASS an action that takes input is given a form of its own validations')

;(User as any).dashboard.actions = declared
server?.stop?.()
console.log('model actions OK')
process.exit(0)
