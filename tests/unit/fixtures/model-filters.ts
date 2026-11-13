/**
 * A list's filters through the list endpoint, against real SQLite
 * (stacksjs/stacks#3296): which filters each model's list offers, and what
 * each kind of comparison finds in rows that are really there.
 *
 * The shipped models as they are, on the tables their definitions make.
 *
 * Its own process because the ORM reads its database once, at first import.
 * Spawned by dashboard-model-filters.test.ts.
 */
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'

const database = process.env.DB_DATABASE_PATH
assert(database)

const { overridesReady } = await import('@stacksjs/config')
await overridesReady.catch(() => undefined)
const { db, ensureDatabaseConfigLoaded, initializeDbConfig } = await import('@stacksjs/database/runtime')
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test' }, database: { default: 'sqlite', connections: { sqlite: { database } }, queryLogging: { enabled: false } } })
const { buildMigrationPlan, configureOrm, generateSql, loadModels } = await import('bun-query-builder')
configureOrm({ database })
const orm = await import('@stacksjs/orm') as Record<string, any>
await orm.ormReady

const TABLES = ['boards', 'email_lists', 'notification_deliveries', 'teams', 'users']
const plan = buildMigrationPlan(await loadModels({ modelsDir: join(import.meta.dir, '../../../storage/framework/defaults/app/Models') }), { dialect: 'sqlite' })
plan.tables = plan.tables.filter(table => TABLES.includes(table.table))
assert.deepEqual(plan.tables.map(table => table.table).sort(), TABLES)
for (const table of plan.tables) {
  for (const column of table.columns)
    delete column.references
}
// generateSql also writes migration files under the working directory.
const scratch = mkdtempSync(join(tmpdir(), 'stacks-model-filters-sql-'))
writeFileSync(join(scratch, 'package.json'), '{}')
const cwd = process.cwd()
try {
  process.chdir(scratch)
  for (const statement of generateSql(plan))
    await db.unsafe(statement).execute()
}
finally {
  process.chdir(cwd)
  rmSync(scratch, { recursive: true, force: true })
}

// The server injects models as globals; the dashboard resolves them there.
for (const name of ['Board', 'EmailList', 'NotificationDelivery', 'Team', 'User'])
  (globalThis as Record<string, unknown>)[name] = orm[name]
// A number is a filter only where the model names it. No shipped model in
// this fixture names one, so the email list names its count here, to ask for
// a range through the endpoint.
orm.EmailList.traits.useSearch.filterable = [...orm.EmailList.traits.useSearch.filterable, 'subscriberCount']

await db.insertInto('users').values([
  { id: 1, name: 'Ava Stone', email: 'ava@example.com', password: 'h', created_at: '2026-03-01T09:00:00.000' },
  { id: 2, name: 'Donald Kelly', email: 'donald@example.com', password: 'h', created_at: '2026-03-01T09:00:00.000' },
] as never).execute()
const delivery = (id: number, channel: string, status: string, userId: number | null, createdAt: string) => ({ id, channel, status, user_id: userId, recipient: `r${id}@example.com`, subject: 'Receipt', body: 'Thanks.', created_at: createdAt })
await db.insertInto('notification_deliveries').values([
  delivery(1, 'email', 'failed', 1, '2026-03-01T08:00:00.000'),
  delivery(2, 'email', 'sent', 1, '2026-03-02T23:30:00.000'),
  delivery(3, 'sms', 'failed', 2, '2026-03-03T00:10:00.000'),
  delivery(4, 'push', 'failed', 2, '2026-03-05T12:00:00.000'),
  delivery(5, 'push', 'delivered', null, '2026-03-09T12:00:00.000'),
] as never).execute()
await db.insertInto('teams').values([
  { id: 1, name: 'Northwind', status: 'active', created_at: '2026-03-01T09:00:00.000' },
  { id: 2, name: 'Globex', status: 'inactive', created_at: '2026-03-01T09:00:00.000' },
  { id: 3, name: 'Initech', status: 'active', created_at: '2026-03-01T09:00:00.000' },
] as never).execute()
await db.insertInto('email_lists').values([
  { id: 1, name: 'Newsletter', slug: 'newsletter', status: 'active', is_public: 1, double_opt_in: 0, subscriber_count: 40, created_at: '2026-03-01T09:00:00.000' },
  { id: 2, name: 'Staff', slug: 'staff', status: 'active', is_public: 0, double_opt_in: 1, subscriber_count: 0, created_at: '2026-03-01T09:00:00.000' },
  { id: 3, name: 'Beta', slug: 'beta', status: 'archived', is_public: 0, double_opt_in: 0, subscriber_count: 3, created_at: '2026-03-01T09:00:00.000' },
] as never).execute()

await db.insertInto('boards').values([
  { id: 1, name: 'Roadmap', team_id: 1, position: 1, archived: 0, created_at: '2026-03-01T09:00:00.000' },
  { id: 2, name: 'Old launch', team_id: 1, position: 2, archived: 1, created_at: '2026-03-01T09:00:00.000' },
  { id: 3, name: 'Support', team_id: 2, position: 3, archived: 0, created_at: '2026-03-01T09:00:00.000' },
] as never).execute()

const { default: ModelShowAction } = await import('../../../storage/framework/defaults/app/Actions/Dashboard/Models/ModelShowAction')

interface Listing { status: number, message?: string, ids: number[], total: number, filterable: Array<Record<string, any>>, sortable: string[], columns: string[], relationNames: Record<string, Record<string, string>> }
async function list(slug: string, filters?: unknown, extra: Record<string, string> = {}): Promise<Listing> {
  const query: Record<string, string> = { sort: 'id', dir: 'asc', ...extra, ...(filters === undefined ? {} : { filters: typeof filters === 'string' ? filters : JSON.stringify(filters) }) }
  const answer = await ModelShowAction.handle({
    getParam: (key: string) => ({ slug } as Record<string, string>)[key],
    get: (key: string, fallback?: unknown) => query[key] ?? fallback,
    all: () => query,
    query,
  } as any)
  if (answer instanceof Response) {
    const body = await answer.json() as { message?: string }
    return { status: answer.status, message: body.message, ids: [], total: 0, filterable: [], sortable: [], columns: [], relationNames: {} }
  }
  const body = answer as Record<string, any>
  return { status: 200, ids: body.rows.map((row: any) => Number(row.id)), total: body.totalCount, filterable: body.filterable, sortable: body.sortable, columns: body.columns, relationNames: body.relationNames }
}
const kinds = (listing: Listing) => listing.filterable.map(filter => `${filter.name}:${filter.kind}`)

// 1. What each list offers, from what the model says its fields are.
const deliveries = await list('notification-delivery')
assert.deepEqual(deliveries.ids, [1, 2, 3, 4, 5])
assert.deepEqual(kinds(deliveries), ['channel:choice', 'status:choice', 'user_id:relation', 'sent_at:datetime', 'created_at:datetime', 'updated_at:datetime'])
assert.deepEqual(deliveries.filterable[0]!.options.map((option: any) => option.value), ['email', 'sms', 'chat', 'database', 'push', 'broadcast'], 'the values the field may hold, not only the ones in use')
assert.deepEqual(deliveries.filterable[2]!.relation, { slug: 'user', label: 'User' })
// Prose and structures are searched, not filtered; nothing hidden is offered.
for (const never of ['body', 'subject', 'recipient', 'metadata', 'error'])
  assert(!kinds(deliveries).some(kind => kind.startsWith(`${never}:`)), `${never} is not a filter`)
// A board names the field its results are narrowed by: it comes first.
const boards = await list('board')
assert.deepEqual(kinds(boards), ['archived:boolean', 'team_id:relation', 'created_at:datetime', 'updated_at:datetime'])
// The email list names three. Two are yes or no, and the model says so
// (stacksjs/stacks#3300): declared as numbers, they were asked for as a range.
// A filter is what the model says the field is, never a guess from its name.
const lists = await list('email-list')
assert.deepEqual(kinds(lists).slice(0, 3), ['status:choice', 'is_public:boolean', 'double_opt_in:boolean'])
assert.equal(kinds(lists)[3], 'subscriber_count:number', 'a count the model names is still asked for as a number')
console.log('PASS each list offers the filters its model\'s fields call for')

// 2. A field of text the model named: chosen from what the table holds.
const teams = await list('team')
const status = teams.filterable.find(filter => filter.name === 'status')!
assert.deepEqual([status.kind, status.open, status.options.map((option: any) => option.value)], ['choice', true, ['active', 'inactive']])
assert.deepEqual((await list('team', { status: { in: ['active'] } })).ids, [1, 3])
// A value that is not stored any more matches nothing; it is not an error.
assert.deepEqual((await list('team', { status: { in: ['retired'] } })).total, 0)
console.log('PASS a field of text the model named is chosen from the values stored')

// 3. Each comparison finds the rows it should.
assert.deepEqual((await list('notification-delivery', { channel: { in: ['email', 'sms'] } })).ids, [1, 2, 3], 'any of several')
assert.deepEqual((await list('notification-delivery', { channel: { in: ['email', 'sms'] }, status: { in: ['failed'] } })).ids, [1, 3], 'two filters narrow together')
assert.deepEqual((await list('notification-delivery', { status: 'failed' })).ids, [1, 3, 4], 'exactly, as a link sends it')
assert.deepEqual((await list('notification-delivery', { user_id: { in: ['2'] } })).ids, [3, 4], 'a record')
assert.deepEqual((await list('board', { archived: 'true' })).ids, [2], 'yes')
assert.deepEqual((await list('board', { archived: 'false' })).ids, [1, 3], 'no')
assert.deepEqual((await list('email-list', { is_public: 'true' })).ids, [1], 'yes, of a field that used to be a number')
assert.deepEqual((await list('email-list', { double_opt_in: 'false' })).ids, [1, 3], 'no')
assert.deepEqual((await list('email-list', { subscriber_count: { min: 3 } })).ids, [1, 3], 'at least')
assert.deepEqual((await list('email-list', { subscriber_count: { max: 3 } })).ids, [2, 3], 'at most')
assert.deepEqual((await list('board', { archived: 'false', team_id: '1' })).ids, [1])
// A range of moments: from the start of a day to the start of the day after
// the last one, as the page sends them for the viewer's days. Here the
// viewer is two hours east, so their March 2 began at 22:00 on the 1st.
assert.deepEqual((await list('notification-delivery', { created_at: { from: '2026-03-01T22:00:00.000Z', to: '2026-03-03T22:00:00.000Z' } })).ids, [2, 3], 'the viewer\'s March 2 and 3')
assert.deepEqual((await list('notification-delivery', { created_at: { from: '2026-03-05T00:00:00.000Z' } })).ids, [4, 5], 'an open end')
assert.deepEqual((await list('notification-delivery', { created_at: { to: '2026-03-01T08:00:00.000Z' } })).ids, [], 'the end is not included')
console.log('PASS every kind of comparison finds the rows it should')

// 4. A comparison that does not suit a field is refused, in words, before the database is asked.
const refusals: Array<[unknown, string]> = [
  [{ channel: { in: ['fax'] } }, 'Channel cannot be "fax".'],
  [{ channel: 'fax' }, 'Channel cannot be "fax".'],
  [{ status: { min: 1 } }, 'Status is not a number, so it has no minimum or maximum.'],
  [{ channel: { from: '2026-03-01T00:00:00.000Z' } }, 'Channel is not a date, so it has no range of days.'],
  [{ created_at: { from: 'yesterday' } }, 'Created from must be a date and time.'],
  [{ created_at: { in: ['2026-03-01'] } }, 'Created cannot be matched against a list of values.'],
  // A column the list shows but does not offer as a filter can only be matched exactly.
  [{ subject: { in: ['Receipt'] } }, 'Subject is not one of this list\'s filters, so it can only be matched exactly.'],
]
for (const [filters, message] of refusals) {
  const refused = await list('notification-delivery', filters)
  assert.deepEqual([refused.status, refused.message], [422, message], JSON.stringify(filters))
}
const yesNo = await list('board', { archived: 'maybe' })
assert.deepEqual([yesNo.status, yesNo.message], [422, 'Archived is yes or no.'])
// And one for a column the page is never sent is refused as unknown, as before.
assert.equal((await list('user', { password: 'h' })).status, 422)
// A comparison the list does not have at all is refused the same way.
const unknown = await list('notification-delivery', '{"status":{"like":"%"}}')
assert.deepEqual([unknown.status, unknown.message], [422, 'Model filter "status" is not a comparison the list has: use a value, { in }, { from, to } or { min, max }'])
console.log('PASS a comparison that does not suit a field is refused before the query')

// 5. The records a list is narrowed by are named, even when nothing matches.
const none = await list('notification-delivery', { user_id: { in: ['1'] }, status: { in: ['delivered'] } })
assert.equal(none.total, 0)
assert.deepEqual(none.relationNames.user_id, { 1: 'Ava Stone' })
assert.deepEqual((await list('notification-delivery', { user_id: '2' })).relationNames.user_id, { 2: 'Donald Kelly' })
console.log('PASS a record a list is narrowed by is named for its chip')

// 6. What a list is ordered by: not another record's id, and not a structure.
assert(deliveries.columns.includes('user_id') && deliveries.columns.includes('metadata'))
assert(!deliveries.sortable.includes('user_id'), 'the cell shows a name; its id has no order a person would see')
assert(!deliveries.sortable.includes('metadata'))
for (const column of ['id', 'channel', 'status', 'recipient', 'created_at'])
  assert(deliveries.sortable.includes(column), `${column} can be sorted`)
console.log('PASS a list is ordered by stored values, not by another record\'s id')

console.log('model filters OK')
process.exit(0)
