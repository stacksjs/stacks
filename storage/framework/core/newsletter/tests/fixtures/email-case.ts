// An address is one person however it is capitalised (stacksjs/stacks#3155).
// subscribe() stored it as typed while syncListSubscribers() and the bounce
// path looked it up lowercased, so a signup as Alice@Example.com that later
// unsubscribed was subscribed again by the next sync.
import assert from 'node:assert/strict'
import { join } from 'node:path'
import process from 'node:process'
import { db, ensureDatabaseConfigLoaded, initializeDbConfig } from '@stacksjs/database/runtime'
import { buildMigrationPlan, generateSql, loadModels } from 'bun-query-builder'
import { lists, subscribe, syncListSubscribers, unsubscribe, unsubscribeAll } from '../../src'

const dialect = process.env.DB_CONNECTION as 'sqlite' | 'postgres' | 'mysql'
assert(dialect === 'sqlite' || dialect === 'postgres' || dialect === 'mysql')
if (dialect !== 'sqlite') {
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(process.env.DB_HOST!))
  await ensureDatabaseConfigLoaded()
  initializeDbConfig({ app: { env: 'test' }, database: {
    default: dialect,
    connections: { [dialect]: { name: process.env.DB_DATABASE, host: process.env.DB_HOST, port: Number(process.env.DB_PORT), username: process.env.DB_USERNAME, password: process.env.DB_PASSWORD } },
    queryLogging: { enabled: false },
  } })
}

// The three tables as the models define them.
const TABLES = ['email_list_subscribers', 'email_lists', 'subscribers']
const plan = buildMigrationPlan(await loadModels({ modelsDir: join(import.meta.dir, '../../../../defaults/app/Models') }), { dialect })
plan.tables = plan.tables.filter(table => TABLES.includes(table.table))
assert.deepEqual(plan.tables.map(table => table.table).sort(), TABLES)
for (const table of plan.tables) {
  for (const column of table.columns)
    delete column.references
}
for (const statement of generateSql(plan))
  await db.unsafe(statement).execute()
await lists.create({ name: 'Weekly', slug: 'weekly' })

const subscribed = async (): Promise<string[]> => (await db.unsafe(
  `SELECT s.email FROM email_list_subscribers p JOIN subscribers s ON s.id = p.subscriber_id WHERE p.status = 'subscribed'`,
).execute() as Array<{ email: string }>).map(row => row.email)

// A signup as typed, then an unsubscribe from the email's link.
const signup = await subscribe(' Alice@Example.com ', { list: 'weekly' })
assert.equal((await unsubscribe(signup.token)).ok, true)

// The nightly sync of the school's contacts must leave the opt-out alone.
const sync = await syncListSubscribers('weekly', [{ email: 'alice@example.com' }])
assert.equal(sync.added, 0, `the sync added her back: ${JSON.stringify(sync)}`)
assert.equal(sync.unsubscribed, 1)
assert.deepEqual(await subscribed(), [])

// Signing up again under another spelling is the same person returning, not a second row.
const again = await subscribe('ALICE@example.com', { list: 'weekly' })
assert.equal(again.created, false)
assert.equal(again.token, signup.token)
assert.deepEqual(await subscribed(), ['alice@example.com'])

// A bounce report for any spelling unsubscribes her.
assert.equal(await unsubscribeAll('Alice@EXAMPLE.com'), 1)
assert.deepEqual(await subscribed(), [])
console.log('newsletter email case OK')
