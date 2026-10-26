/**
 * The storefront flow, end to end, on one dialect (stacksjs/stacks#3017).
 *
 * Builds every table from the models, the way `buddy migrate` does on a fresh
 * database, seeds one product, then runs the real actions in the order a
 * shopper does: add to cart, read it, change a quantity, contact, shipping,
 * place the order, review it. The cart cookie travels between them as a
 * browser would carry it. Run by ../storefront-flow.test.ts in its own
 * process per dialect, since database config is process-wide.
 */

import assert from 'node:assert/strict'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

const dialect = process.env.DB_CONNECTION
assert(dialect === 'sqlite' || dialect === 'postgres' || dialect === 'mysql')

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
const modelsRoot = join(import.meta.dir, '../../../storage/framework/defaults/app/Models')
const directories = [modelsRoot, ...readdirSync(modelsRoot, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => join(modelsRoot, entry.name))]
let models = {}
for (const modelsDir of directories)
  models = { ...models, ...(await loadModels({ modelsDir })) }
const statements = generateSql(buildMigrationPlan(models, { dialect }))

const actions = '../../../storage/framework/defaults/app/Actions/Storefront'
const { default: AddToCart } = await import(`${actions}/AddToCartAction`)
const { default: GetCart } = await import(`${actions}/GetCartAction`)
const { default: UpdateCartItem } = await import(`${actions}/UpdateCartItemAction`)
const { default: CheckoutContact } = await import(`${actions}/CheckoutContactAction`)
const { default: CheckoutShipping } = await import(`${actions}/CheckoutShippingAction`)
const { default: PlaceOrder } = await import(`${actions}/PlaceOrderAction`)
const { default: SubmitReview } = await import(`${actions}/SubmitReviewAction`)

/** The shopper's browser: the cookies the actions set travel to the next request. */
const jar = new Map<string, string>()
function request(input: Record<string, unknown>): any {
  return {
    get: (key: string) => input[key],
    headers: new Headers({ accept: 'application/json' }),
    cookies: {
      get: (name: string) => jar.get(name),
      set: (name: string, value: string) => { jar.set(name, value) },
      delete: (name: string) => { jar.delete(name) },
    },
  }
}

async function run(action: { handle: (request: any) => unknown }, input: Record<string, unknown>): Promise<any> {
  const result = await action.handle(request(input)) as Response
  const body = await result.json()
  assert(result.status < 400, `${dialect}: ${JSON.stringify(input)} answered ${result.status} ${JSON.stringify(body)}`)
  return body
}

async function one(table: string, column: string, value: unknown): Promise<Record<string, any>> {
  const row = await db.selectFrom(table).selectAll().where(column, '=', value).executeTakeFirst() as Record<string, any> | undefined
  assert(row, `${dialect}: no ${table} row where ${column} = ${value}`)
  return row
}

try {
  for (const statement of statements)
    await db.unsafe(statement).execute()

  await db.insertInto('products').values({
    name: 'Trail Runner', slug: 'trail-runner', price: 12500, is_available: true,
    inventory_count: 10, preparation_time: 1, uuid: crypto.randomUUID(),
  }).execute()

  const added = await run(AddToCart, { slug: 'trail-runner', quantity: 2 })
  assert(jar.has('stacks_cart'), `${dialect}: adding to the cart sets the cart cookie`)

  const cart = await run(GetCart, {})
  assert.equal(cart.items.length, 1, `${dialect}: the cart holds the product`)
  assert.equal(cart.total_items, 2)

  await run(UpdateCartItem, { item_id: cart.items[0].id, quantity: 3 })
  assert.equal(Number((await one('carts', 'id', added.cart_id)).total_items), 3, `${dialect}: the new quantity is stored`)

  await run(CheckoutContact, { email: 'ada@example.test' })
  await run(CheckoutShipping, { shipping_name: 'Ada Lovelace', shipping_address: '12 Analytical Way', shipping_city: 'London', shipping_state: 'LDN', shipping_zip: 'N1 9GU' })

  const placed = await run(PlaceOrder, {})
  const order = await one('orders', 'id', placed.order_id)
  assert.equal(Number(order.total_amount), placed.total, `${dialect}: the order's total`)
  assert.equal(Number((await one('order_items', 'order_id', order.id)).quantity), 3, `${dialect}: the order line`)
  assert.equal(Number((await one('products', 'slug', 'trail-runner')).inventory_count), 7, `${dialect}: stock is taken`)
  assert.equal((await one('customers', 'email', 'ada@example.test')).name, 'Ada Lovelace', `${dialect}: the customer`)
  assert.equal((await one('carts', 'id', added.cart_id)).status, 'converted', `${dialect}: the cart is closed`)
  assert(!jar.has('stacks_cart'), `${dialect}: placing the order clears the cart cookie`)

  await run(SubmitReview, { order_id: order.id, product_slug: 'trail-runner', rating: 5, title: 'Light and quick', content: 'Ran a half marathon in them the first week.', email: 'ada@example.test' })
  const review = await one('reviews', 'order_id', order.id)
  assert.equal(Number(review.rating), 5, `${dialect}: the review`)
  assert.equal(Boolean(review.is_verified_purchase), true, `${dialect}: a verified purchase`)
  assert.equal(Boolean(review.is_approved), false, `${dialect}: awaiting moderation`)

  console.log(`storefront flow OK on ${dialect}`)
}
finally { resetDatabaseConnection() }
