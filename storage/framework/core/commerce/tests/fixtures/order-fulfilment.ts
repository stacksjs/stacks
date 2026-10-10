import assert from 'node:assert/strict'
import { join } from 'node:path'
import { db, ensureDatabaseConfigLoaded, initializeDbConfig, resetDatabaseConnection, lockRow } from '@stacksjs/database/runtime'
import { transitionStatus } from '../../src/orders/transition'
const directory = process.env.STACKS_ORDER_TEST_DIRECTORY!
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test' }, database: { default: 'sqlite', connections: { sqlite: { database: join(directory, 'test.sqlite') } }, queryLogging: { enabled: false } } })
await db.unsafe('CREATE TABLE orders (id INTEGER PRIMARY KEY, status TEXT, updated_at TEXT)').execute()
await db.unsafe('CREATE TABLE access_grants (id INTEGER PRIMARY KEY, order_id INTEGER UNIQUE)').execute()
await db.insertInto('orders').values({ id: 1, status: 'PENDING' }).execute()
await assert.rejects(() => transitionStatus(1, 'PENDING', 'PROCESSING', { apply: async () => {
  await db.insertInto('access_grants').values({ id: 1, order_id: 1 }).execute()
  throw new Error('delivery failed')
} }), /delivery failed/)
assert.equal((await db.selectFrom('orders').selectAll().where('id', '=', 1).executeTakeFirst())?.status, 'PENDING')
assert.equal((await db.selectFrom('access_grants').selectAll().execute()).length, 0)
const apply = async () => { await db.insertInto('access_grants').values({ id: 1, order_id: 1 }).execute() }
const results = await Promise.all([transitionStatus(1, 'PENDING', 'PROCESSING', { apply }), transitionStatus(1, 'PENDING', 'PROCESSING', { apply })])
assert.equal(results.filter(Boolean).length, 1)
assert.equal((await db.selectFrom('access_grants').selectAll().execute()).length, 1)
await assert.rejects(() => lockRow(db, 'orders; DROP TABLE orders', { id: 1 }), /Invalid SQL identifier/)
await assert.rejects(() => lockRow(db, 'orders', {}), /requires a scope/)
await db.transaction(async (trx) => { assert.equal((await lockRow(trx, 'orders', { id: 1 }))?.status, 'PROCESSING') })
await resetDatabaseConnection()
console.log('order fulfilment OK')
