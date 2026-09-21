/**
 * Writes that return the row they wrote must work on MySQL. stacksjs/stacks#2637.
 *
 * `returningAll()` in bun-query-builder 0.2.69 appended ` RETURNING *` to the
 * statement on every dialect, and MySQL has no RETURNING clause, so each of
 * these was a syntax error there and wrote nothing. 0.2.70 routes it through
 * `returning('*')`, which reads the rows back on MySQL. These are the calls the
 * report ran, through the functions the dashboard's PATCH routes use, plus the
 * category insert the write-counts fixture had to seed around.
 */

import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import process from 'node:process'

const dialect = process.env.DB_CONNECTION
assert(dialect === 'sqlite' || dialect === 'postgres' || dialect === 'mysql')
const configPath = process.env.STACKS_COMMERCE_RETURNING_ALL_CONFIG
assert(configPath && basename(dirname(configPath)).startsWith('stacks-commerce-returning-all-'))
if (dialect === 'sqlite') {
  assert.equal(dirname(process.env.DB_DATABASE_PATH!), dirname(configPath))
}
else {
  assert.equal(process.env.DB_DATABASE_PATH, ':memory:')
  assert(process.env.DB_DATABASE?.startsWith('stacks_commerce_returning_all_'))
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

const TABLES = ['carts', 'categories', 'product_units', 'product_variants', 'products', 'shipping_methods', 'shipping_rates', 'shipping_zones']
const { buildMigrationPlan, generateSql, loadModels } = await import('bun-query-builder')
const modelsDir = join(import.meta.dir, '../../../../../defaults/app/Models')
const models = { ...(await loadModels({ modelsDir })), ...(await loadModels({ modelsDir: join(modelsDir, 'commerce') })) }
const plan = buildMigrationPlan(models, { dialect })
plan.tables = plan.tables.filter(table => TABLES.includes(table.table))
assert.deepEqual(plan.tables.map(table => table.table).sort(), TABLES)
for (const table of plan.tables) {
  for (const column of table.columns)
    delete column.references
}
// generateSql also writes migration files under the working directory.
const scratch = mkdtempSync(join(tmpdir(), 'stacks-commerce-returning-all-sql-'))
writeFileSync(join(scratch, 'package.json'), '{}')
const cwd = process.cwd()
let statements: string[]
try {
  process.chdir(scratch)
  statements = generateSql(plan)
}
finally {
  process.chdir(cwd)
  rmSync(scratch, { recursive: true, force: true })
}

const { update: updateCart } = await import('../../carts/update')
const { update: updateItem } = await import('../../products/items/update')
const { update: updateVariant } = await import('../../products/variants/update')
const { update: updateUnit } = await import('../../products/units/update')
const { update: updateRate } = await import('../../shippings/shipping-rates/update')
const { store: storeCategory } = await import('../../products/categories/store')

async function stored(table: string, id: unknown): Promise<Record<string, unknown> | undefined> {
  return await db.selectFrom(table).selectAll().where('id', '=', id).executeTakeFirst() as Record<string, unknown> | undefined
}

const failures: string[] = []
async function check(name: string, run: () => Promise<void>) {
  try {
    await run()
    console.log(`PASS ${name}`)
  }
  catch (error) { failures.push(`${name}: ${error instanceof Error ? error.message : String(error)}`) }
}

try {
  for (const statement of statements)
    await db.unsafe(statement).execute()

  await db.insertInto('carts').values({ id: 1, status: 'active', expires_at: '2030-02-01 00:00:00', applied_coupon_id: 'none' }).execute()
  await db.insertInto('products').values({ id: 1, name: 'before', price: 100, preparation_time: 5 }).execute()
  await db.insertInto('product_variants').values({ id: 1, variant: 'Size', type: 'dropdown', status: 'active' }).execute()
  await db.insertInto('product_units').values({ id: 1, name: 'gram', abbreviation: 'g', type: 'weight' }).execute()
  await db.insertInto('shipping_methods').values({ id: 1, name: 'standard', base_rate: 500, status: 'active' }).execute()
  await db.insertInto('shipping_zones').values({ id: 1, name: 'domestic', status: 'active', shipping_method_id: 1 }).execute()
  await db.insertInto('shipping_rates').values({ id: 1, weight_from: 0, weight_to: 10, rate: 100, shipping_method_id: 1, shipping_zone_id: 1 }).execute()

  // Each returns the row it wrote, and the row is actually written: on MySQL
  // before the fix the statement failed to parse, so neither held.
  await check('carts update', async () => {
    const row = await updateCart(1, { notes: 'after' } as never) as Record<string, unknown>
    assert.equal(row?.notes, 'after', `${dialect}: the returned cart`)
    assert.equal((await stored('carts', 1))?.notes, 'after', `${dialect}: the stored cart`)
  })

  await check('product items update', async () => {
    const row = await updateItem(1, { name: 'after' } as never) as Record<string, unknown> | undefined
    assert.equal(row?.name, 'after', `${dialect}: the returned product`)
    assert.equal((await stored('products', 1))?.name, 'after', `${dialect}: the stored product`)
  })

  await check('product variants update', async () => {
    const row = await updateVariant(1, { variant: 'Colour' } as never) as Record<string, unknown> | undefined
    assert.equal(row?.variant, 'Colour', `${dialect}: the returned variant`)
    assert.equal((await stored('product_variants', 1))?.variant, 'Colour', `${dialect}: the stored variant`)
  })

  await check('product units update', async () => {
    const row = await updateUnit(1, { name: 'kilogram' } as never) as Record<string, unknown> | undefined
    assert.equal(row?.name, 'kilogram', `${dialect}: the returned unit`)
    assert.equal((await stored('product_units', 1))?.name, 'kilogram', `${dialect}: the stored unit`)
  })

  await check('shipping rates update', async () => {
    const row = await updateRate(1, { rate: 250 } as never) as Record<string, unknown> | undefined
    assert.equal(Number(row?.rate), 250, `${dialect}: the returned rate`)
    assert.equal(Number((await stored('shipping_rates', 1))?.rate), 250, `${dialect}: the stored rate`)
  })

  await check('categories store', async () => {
    const row = await storeCategory({ name: 'Shoes', slug: `shoes-${dialect}`, display_order: 1 } as never) as Record<string, unknown>
    assert(row?.id, `${dialect}: the inserted category comes back with its id`)
    assert.equal(row.name, 'Shoes')
    assert.equal((await stored('categories', row.id))?.slug, `shoes-${dialect}`, `${dialect}: the stored category`)
  })

  assert.deepEqual(failures, [], `${dialect}: every returningAll() write must apply and return its row`)
  console.log('commerce returningAll writes OK')
}
finally { resetDatabaseConnection() }
