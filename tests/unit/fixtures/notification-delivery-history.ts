/**
 * Runs `readDeliveryHistory` against a disposable database of the given
 * dialect, with `notification_deliveries` built from its model, and checks
 * every answer against filtering, searching, sorting and slicing the seed in
 * memory. The search threw on every dialect before it was a `whereILike`
 * group, which the History page showed as a 503.
 */

import assert from 'node:assert/strict'
import { basename, dirname, join } from 'node:path'
import process from 'node:process'

const dialect = process.env.DB_CONNECTION
assert(dialect === 'sqlite' || dialect === 'postgres' || dialect === 'mysql')
const configPath = process.env.STACKS_DELIVERY_HISTORY_CONFIG
assert(configPath && basename(dirname(configPath)).startsWith('stacks-delivery-history-'))
if (dialect === 'sqlite') {
  assert.equal(dirname(process.env.DB_DATABASE_PATH!), dirname(configPath))
}
else {
  assert.equal(process.env.DB_DATABASE_PATH, ':memory:')
  assert(process.env.DB_DATABASE?.startsWith('stacks_delivery_history_'))
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(process.env.DB_HOST!))
}

const { overridesReady } = await import('@stacksjs/config')
await overridesReady
const { db, ensureDatabaseConfigLoaded, initializeDbConfig, resetDatabaseConnection } = await import('@stacksjs/database')
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test' }, database: {
  default: dialect,
  connections: dialect === 'sqlite' ? { sqlite: { database: process.env.DB_DATABASE_PATH } } : {
    [dialect]: { name: process.env.DB_DATABASE, host: process.env.DB_HOST, port: Number(process.env.DB_PORT), username: process.env.DB_USERNAME, password: process.env.DB_PASSWORD },
  },
  queryLogging: { enabled: false },
} })

const { buildMigrationPlan, generateSql, loadModels } = await import('bun-query-builder')
const plan = buildMigrationPlan(await loadModels({ modelsDir: join(import.meta.dir, '../../../storage/framework/defaults/app/Models') }), { dialect })
plan.tables = plan.tables.filter(table => table.table === 'notification_deliveries')
assert.equal(plan.tables.length, 1)
for (const column of plan.tables[0]!.columns)
  delete column.references

const { formatDate } = await import('@stacksjs/orm')
const { DELIVERY_SEARCH_COLUMNS, DELIVERY_SORTS, readDeliveryHistory } = await import('../../../storage/framework/defaults/app/Actions/Dashboard/Notifications/notification-delivery-history')
type Query = Parameters<typeof readDeliveryHistory>[0]

const CHANNELS = ['email', 'sms', 'push'] as const
const STATUSES = ['sent', 'failed', 'delivered', 'pending'] as const
const HOUR = 3_600_000
const START = Date.UTC(2026, 3, 1)

// Ties on purpose: seven recipients, three rows an hour, so every sort but id
// leans on the id that ends the order.
const seed = Array.from({ length: 30 }, (_, index) => {
  const id = index + 1
  return {
    id,
    channel: CHANNELS[id % 3]!,
    status: STATUSES[id % 4]!,
    recipient: `user${String(id % 7).padStart(2, '0')}@example.test`,
    subject: id % 5 === 0 ? null : id % 3 === 0 ? 'Weekly NEEDLE digest' : 'Welcome',
    body: id % 4 === 0 ? 'Your needle report' : 'Hello there',
    error: id % 6 === 0 ? 'SMTP Needle timeout' : null,
    sentAt: START + Math.floor(id / 3) * HOUR,
  }
})
type Seeded = typeof seed[number]

function sortValue(row: Seeded, sort: Query['sort']): string | number {
  return sort === 'sent_at' ? row.sentAt : row[sort]
}

function answer(query: Query): number[] {
  const term = query.search.toLowerCase()
  const sign = query.direction === 'asc' ? 1 : -1
  return seed
    .filter(row => (!query.channel || row.channel === query.channel)
      && (!query.status || row.status === query.status)
      && (!term || DELIVERY_SEARCH_COLUMNS.some(column => (row[column] ?? '').toLowerCase().includes(term))))
    .sort((a, b) => {
      const x = sortValue(a, query.sort)
      const y = sortValue(b, query.sort)
      return (x < y ? -1 : x > y ? 1 : 0) * sign || (a.id - b.id) * sign
    })
    .map(row => row.id)
}

try {
  for (const statement of generateSql(plan))
    await db.unsafe(statement).execute()
  for (const row of seed) {
    await db.insertInto('notification_deliveries').values({
      id: row.id,
      channel: row.channel,
      status: row.status,
      recipient: row.recipient,
      subject: row.subject,
      body: row.body,
      error: row.error,
      sent_at: formatDate(new Date(row.sentAt)),
      created_at: formatDate(new Date(row.sentAt)),
    } as any).execute()
  }

  async function check(label: string, query: Query): Promise<void> {
    const all = answer(query)
    const result = await readDeliveryHistory(query)
    assert.equal(Number(result.total), all.length, `${dialect} ${label}: total`)
    assert.deepEqual(result.rows.map(row => Number(row.id)), all.slice((query.page - 1) * query.perPage, query.page * query.perPage), `${dialect} ${label}: rows`)
  }

  const base: Query = { page: 1, perPage: 7, channel: null, status: null, search: '', sort: 'sent_at', direction: 'desc' }
  // The seed must reach each search column in more than one case, or a check
  // below passes on nothing.
  for (const column of DELIVERY_SEARCH_COLUMNS)
    assert(seed.some(row => row[column]?.toLowerCase().includes(column === 'recipient' ? 'user03' : column === 'body' ? 'hello' : 'needle')), column)
  assert(seed.some(row => row.subject?.includes('NEEDLE')) && seed.some(row => row.body.includes('needle')))

  for (const sort of DELIVERY_SORTS) {
    for (const direction of ['asc', 'desc'] as const) {
      for (const page of [1, 2, 5])
        await check(`sort ${sort} ${direction} page ${page}`, { ...base, sort, direction, page })
    }
  }
  for (const channel of CHANNELS)
    await check(`channel ${channel}`, { ...base, channel, perPage: 50 })
  await check('channel and status', { ...base, channel: 'email', status: 'failed', perPage: 50 })
  for (const search of ['needle', 'NEEDLE', 'Needle', 'user03', 'SMTP', 'hello', 'nothing like this'])
    await check(`search "${search}"`, { ...base, search, perPage: 50 })
  await check('search a second page', { ...base, search: 'needle', perPage: 4, page: 2 })
  await check('search within a channel and status', { ...base, search: 'needle', channel: 'push', status: 'sent', perPage: 50 })

  console.log('delivery history OK')
}
finally { resetDatabaseConnection() }
