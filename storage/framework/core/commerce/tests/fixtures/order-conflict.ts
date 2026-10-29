import assert from 'node:assert/strict'
import { db, ensureDatabaseConfigLoaded, initializeDbConfig, resetDatabaseConnection } from '@stacksjs/database/runtime'
import { placeOrder } from '../../src/orders/place-order'
await ensureDatabaseConfigLoaded()
const dialect = process.env.DB_CONNECTION === 'postgres' ? 'postgres' : 'sqlite'
initializeDbConfig({ app: { env: 'test' }, database: { default: dialect, connections: {
  sqlite: { database: process.env.DB_DATABASE_PATH },
  postgres: { name: process.env.DB_DATABASE, host: process.env.DB_HOST, port: Number(process.env.DB_PORT), username: process.env.DB_USERNAME, password: process.env.DB_PASSWORD },
}, queryLogging: { enabled: false } } })
const primaryKey = dialect === 'postgres' ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY'
await db.unsafe(`CREATE TABLE orders (id ${primaryKey}, uuid TEXT UNIQUE, status TEXT, stripe_invoice_id TEXT UNIQUE, total_amount INTEGER, created_at TEXT, updated_at TEXT)`).execute()
await db.unsafe(`CREATE TABLE order_items (id ${primaryKey}, order_id INTEGER, product_id INTEGER, quantity INTEGER, price INTEGER, special_instructions TEXT, created_at TEXT, updated_at TEXT)`).execute()
const input = { order: { stripe_invoice_id: 'in_same_invoice', total_amount: 1999 }, items: [{ productId: 1, quantity: 1, price: 1999 }] }
const results = await Promise.all([placeOrder(input as never), placeOrder(input as never)])
assert.equal(results.filter(result => result.ok).length, 1)
assert.deepEqual(results.filter(result => !result.ok).map(result => ({ reason: result.reason, failedAt: result.failedAt })), [{ reason: 'duplicate-order', failedAt: 'order' }])
assert.equal((await db.selectFrom('orders').selectAll().execute()).length, 1)
assert.equal((await db.selectFrom('order_items').selectAll().execute()).length, 1)
await assert.rejects(() => placeOrder({ order: { nonexistent_column: 'not a conflict' } } as never), /nonexistent_column/)
await resetDatabaseConnection()
console.log('order conflicts OK')
