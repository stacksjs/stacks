/**
 * The actions the shipped models name, through a real server, against real
 * SQLite (stacksjs/stacks#3286): each is offered only to the records its
 * `when` names, and pressing it runs the action the framework already had.
 *
 * Nothing here is a stand-in for the action: a failed job really goes back
 * on its queue, a scheduled campaign is really cancelled, and what an action
 * refuses is what the operator is told.
 *
 * Its own process because the ORM reads its database once, at first import.
 * Spawned by dashboard-shipped-declarations.test.ts.
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
const { db, ensureDatabaseConfigLoaded, initializeDbConfig, sqlDateTime } = await import('@stacksjs/database/runtime')
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test' }, database: { default: 'sqlite', connections: { sqlite: { database } }, queryLogging: { enabled: false } } })
const { buildMigrationPlan, configureOrm, generateSql, loadModels } = await import('bun-query-builder')
configureOrm({ database })
const orm = await import('@stacksjs/orm') as Record<string, any>
await orm.ormReady
const { route } = await import('@stacksjs/router')

// The tables as the models define them, so a column a model gains is here too.
const TABLES = ['campaigns', 'email_list_subscribers', 'email_lists', 'failed_jobs', 'jobs', 'notification_deliveries']
const plan = buildMigrationPlan(await loadModels({ modelsDir: join(import.meta.dir, '../../../storage/framework/defaults/app/Models') }), { dialect: 'sqlite' })
plan.tables = plan.tables.filter(table => TABLES.includes(table.table))
assert.deepEqual(plan.tables.map(table => table.table).sort(), TABLES)
for (const table of plan.tables) {
  for (const column of table.columns)
    delete column.references
}
// generateSql also writes migration files under the working directory.
const scratch = mkdtempSync(join(tmpdir(), 'stacks-shipped-actions-sql-'))
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
for (const name of ['Campaign', 'EmailList', 'EmailListSubscriber', 'FailedJob', 'Job', 'NotificationDelivery'])
  (globalThis as Record<string, unknown>)[name] = orm[name]

const now = sqlDateTime()
const campaign = (id: number, type: string, status: string) => ({ id, name: `Campaign ${id}`, type, status, timezone: 'UTC', created_at: now })
await db.insertInto('campaigns').values([
  campaign(1, 'email', 'draft'),
  campaign(2, 'email', 'scheduled'),
  campaign(3, 'email', 'sent'),
  campaign(4, 'sms', 'draft'),
] as never).execute()
const delivery = (id: number, channel: string, status: string) => ({ id, channel, status, recipient: 'ava@example.com', subject: 'Your receipt', body: 'Thanks for your order.', created_at: now })
await db.insertInto('notification_deliveries').values([
  delivery(1, 'email', 'failed'),
  delivery(2, 'email', 'sent'),
  delivery(3, 'push', 'failed'),
] as never).execute()
await db.insertInto('failed_jobs').values([
  { id: 1, connection: 'database', queue: 'default', payload: JSON.stringify({ job: 'SendWelcomeEmail', data: { userId: 7 } }), exception: 'Error: mail server refused the connection', failed_at: now },
] as never).execute()

route.get('/api/dashboard/models/{slug}', 'Actions/Dashboard/Models/ModelShowAction')
route.post('/api/dashboard/models/{dashboardModel}/{id}/actions/{dashboardAction}', 'Actions/Dashboard/Models/ModelActionRunAction').skipCsrf()
const server: any = await route.serve({ port: 0, hostname: '127.0.0.1' })
const origin = `http://127.0.0.1:${Number(server?.port ?? server?.server?.port)}`

interface Listing { actions: Array<Record<string, any>>, rowActions: Record<string, string[]> }
async function list(slug: string): Promise<Listing> {
  const answer = await fetch(`${origin}/api/dashboard/models/${slug}?sort=id&dir=asc`, { headers: { accept: 'application/json' } })
  assert.equal(answer.status, 200, await answer.clone().text())
  return await answer.json() as Listing
}
async function run(slug: string, name: string, id: number): Promise<{ status: number, body: any }> {
  const answer = await fetch(`${origin}/api/dashboard/models/${slug}/${id}/actions/${name}`, {
    method: 'POST',
    headers: { 'accept': 'application/json', 'content-type': 'application/json' },
    body: '{}',
  })
  const answered = await answer.json().catch(() => null)
  if (answered && typeof answered === 'object')
    delete answered.request_id
  return { status: answer.status, body: answered }
}
const row = async (table: string, id: number) => (await db.selectFrom(table as never).selectAll().where('id' as never, '=', id as never).executeTakeFirst()) as Record<string, any> | undefined

// 1. A failed job: offered on its row, its page and a selection, and it runs again.
const jobs = await list('failed-job')
assert.deepEqual(jobs.actions.map(action => [action.name, action.label, action.places, action.fields]), [['retry', 'Retry', ['record', 'row', 'bulk'], []]])
assert.deepEqual(jobs.rowActions, { 1: ['retry'] })
assert.deepEqual(await db.selectFrom('jobs').selectAll().execute(), [])
assert.deepEqual(await run('failed-job', 'retry', 1), { status: 200, body: { ok: true, message: 'Job 1 re-queued', redirect: '' } })
const queued = (await db.selectFrom('jobs').selectAll().execute()) as Array<Record<string, any>>
assert.equal(queued.length, 1, 'it is back on a queue')
assert.equal(queued[0]!.queue, 'default')
assert.match(String(queued[0]!.payload), /SendWelcomeEmail/)
assert.equal((await run('failed-job', 'retry', 99)).status, 404)
console.log('PASS a failed job is put back on its queue from the dashboard')

// 2. A campaign: sending and cancelling are for email campaigns in the states the engine takes them from.
const campaigns = await list('campaign')
assert.deepEqual(campaigns.actions.map(action => [action.name, action.label, action.places, action.destructive]), [
  ['send', 'Send now', ['record'], false],
  ['cancel', 'Cancel delivery', ['record'], true],
])
assert.deepEqual(campaigns.rowActions, { 1: ['send'], 2: ['send', 'cancel'] }, 'a sent campaign and a text campaign are offered neither')
// Cancelling really cancels.
assert.deepEqual(await run('campaign', 'cancel', 2), { status: 200, body: { ok: true, message: '', redirect: '' } })
assert.equal((await row('campaigns', 2))!.status, 'cancelled')
// And is no longer offered once it has.
assert.deepEqual((await list('campaign')).rowActions, { 1: ['send'] })
// What the engine refuses is what the operator is told, and nothing is sent.
const refused = await run('campaign', 'send', 1)
assert.deepEqual(refused, { status: 422, body: { message: 'Email campaigns require an email list.' } })
assert.equal((await row('campaigns', 1))!.status, 'draft')
// Asking for a button that was not offered is refused before the action runs.
assert.equal((await run('campaign', 'send', 3)).status, 409)
assert.equal((await run('campaign', 'cancel', 4)).status, 409)
assert.equal((await row('campaigns', 3))!.status, 'sent')
console.log('PASS a campaign is sent or cancelled only from the states that allow it')

// 3. A notification: only a failed email or text message can be sent again.
const deliveries = await list('notification-delivery')
assert.deepEqual(deliveries.actions.map(action => [action.name, action.label, action.places]), [['retry', 'Send again', ['record', 'row']]])
assert.deepEqual(deliveries.rowActions, { 1: ['retry'] }, 'one that went out, and a failed push, are not offered it')
assert.equal((await run('notification-delivery', 'retry', 2)).status, 409)
assert.equal((await run('notification-delivery', 'retry', 3)).status, 409)
const resent = await run('notification-delivery', 'retry', 1)
console.log(`resend: ${JSON.stringify(resent)}`)
assert.equal(resent.status, 200, JSON.stringify(resent))
assert.equal(resent.body.ok, true)
console.log('PASS a failed notification is sent again, and only a failed one')

console.log('shipped model actions OK')
process.exit(0)
