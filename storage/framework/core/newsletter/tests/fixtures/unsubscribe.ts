// An unsubscribe is recorded on every dialect (stacksjs/stacks#3156). The
// timestamp was written as an ISO string, which MySQL rejects for a DATETIME
// column, so every unsubscribe link failed there.
import assert from 'node:assert/strict'
import { join } from 'node:path'
import process from 'node:process'
import { db, ensureDatabaseConfigLoaded, initializeDbConfig } from '@stacksjs/database/runtime'
import { buildMigrationPlan, generateSql, loadModels } from 'bun-query-builder'
import { lists, subscribe, unsubscribe, unsubscribeAll } from '../../src'

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
await lists.create({ name: 'Offers', slug: 'offers' })

const rows = async () => await db.unsafe(
  `SELECT l.slug, p.status, p.unsubscribed_at FROM email_list_subscribers p JOIN email_lists l ON l.id = p.email_list_id ORDER BY l.slug`,
).execute() as Array<{ slug: string, status: string, unsubscribed_at: unknown }>

// The link in a campaign email.
const weekly = await subscribe('parent@school.test', { list: 'weekly' })
const result = await unsubscribe(weekly.token)
assert.equal(result.ok, true)
assert.equal(result.email, 'parent@school.test')
const [row] = await rows()
assert.equal(row!.status, 'unsubscribed')
assert.ok(row!.unsubscribed_at, 'the unsubscribe is timestamped')
// A column holds sqlDateTime()'s form, UTC with no zone suffix, as every
// framework timestamp does; a driver may answer it as a Date.
const stored = row!.unsubscribed_at
if (!(stored instanceof Date))
  assert.match(String(stored), /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/, 'unsubscribed_at is written with sqlDateTime()')
const at = stored instanceof Date ? stored : new Date(`${String(stored).replace(' ', 'T')}Z`)
assert.ok(Math.abs(at.getTime() - Date.now()) < 10 * 60_000, `unsubscribed_at is now, not ${String(row!.unsubscribed_at)}`)

// A bounce or complaint: every list at once.
await subscribe('parent@school.test', { list: 'weekly' })
await subscribe('parent@school.test', { list: 'offers' })
assert.equal(await unsubscribeAll('parent@school.test'), 2)
assert.deepEqual((await rows()).map(r => [r.slug, r.status, Boolean(r.unsubscribed_at)]), [['offers', 'unsubscribed', true], ['weekly', 'unsubscribed', true]])
console.log('newsletter unsubscribe OK')
