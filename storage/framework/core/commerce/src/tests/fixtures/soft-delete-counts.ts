/**
 * A write that puts a row into a state must not read an affected-row count as
 * "does this row exist". stacksjs/stacks#2639.
 *
 * MySQL counts rows a statement CHANGED; PostgreSQL and SQLite count rows it
 * MATCHED. Every write here sets a state the row may already be in, so on
 * MySQL the UPDATE reported 0 for a row that was right there: `softDelete()`
 * on an order already CANCELED answered false, `bulkSoftDelete()` left every
 * already-inactive row out of its total, and re-deactivating a gift card or
 * re-applying a variant's status reported failure. `updated_at` does not save
 * those last two: `formatDate` has second precision, so a repeat inside one
 * second writes the same value. The clock is frozen for that section, which
 * is what makes "the same second" a fact rather than a race.
 *
 * Runs against a disposable database of the given dialect, with the tables
 * built from the model definitions rather than hand-written DDL, so a column
 * the models change is a failure here rather than a fixture that drifted.
 */

import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import process from 'node:process'

const dialect = process.env.DB_CONNECTION
assert(dialect === 'sqlite' || dialect === 'postgres' || dialect === 'mysql')
const configPath = process.env.STACKS_COMMERCE_SOFT_DELETE_CONFIG
assert(configPath && basename(dirname(configPath)).startsWith('stacks-commerce-soft-delete-'))
if (dialect === 'sqlite') {
  assert.equal(dirname(process.env.DB_DATABASE_PATH!), dirname(configPath))
}
else {
  assert.equal(process.env.DB_DATABASE_PATH, ':memory:')
  assert(process.env.DB_DATABASE?.startsWith('stacks_commerce_soft_delete_'))
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

const TABLES = ['carts', 'digital_deliveries', 'gift_cards', 'license_keys', 'orders', 'product_units', 'product_variants', 'products', 'shipping_methods', 'shipping_rates', 'shipping_zones']
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
const scratch = mkdtempSync(join(tmpdir(), 'stacks-commerce-soft-delete-sql-'))
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

const orders = await import('../../orders/destroy')
const digitalDeliveries = await import('../../shippings/digital-deliveries/destroy')
const licenseKeys = await import('../../shippings/license-keys/destroy')
const shippingMethods = await import('../../shippings/shipping-methods/destroy')
const shippingZones = await import('../../shippings/shipping-zones/destroy')
const { deactivate: deactivateGiftCard } = await import('../../gift-cards/destroy')
const { bulkUpdate: bulkUpdateVariants, updateStatus: updateVariantStatus } = await import('../../products/variants/update')
const { bulkUpdate: bulkUpdateCarts } = await import('../../carts/update')
const { updateByZone: updateRatesByZone } = await import('../../shippings/shipping-rates/update')
const { bulkUpdate: bulkUpdateItems } = await import('../../products/items/update')
const { bulkUpdate: bulkUpdateUnits } = await import('../../products/units/update')

/**
 * Each module, the status its soft delete writes, and four seed rows: 1 and 3
 * already carry that status, 2 and 4 are live. So `softDelete(1)` and the `3`
 * half of the bulk call are the no-op UPDATEs MySQL reports as zero.
 */
const MODULES = [
  {
    name: 'orders',
    table: 'orders',
    deleted: 'CANCELED',
    module: orders,
    row: (id: number, status: string) => ({ id, status, total_amount: 1000, order_type: 'DELIVERY' }),
    live: 'PENDING',
  },
  {
    name: 'shippings/digital-deliveries',
    table: 'digital_deliveries',
    deleted: 'inactive',
    module: digitalDeliveries,
    row: (id: number, status: string) => ({ id, status, name: `delivery-${id}`, description: 'seeded', expiry_days: 7 }),
    live: 'active',
  },
  {
    name: 'shippings/license-keys',
    table: 'license_keys',
    deleted: 'inactive',
    module: licenseKeys,
    row: (id: number, status: string) => ({ id, status, key: `KEY-${id}`, template: 'Standard License', expiry_date: '2030-01-01' }),
    live: 'active',
  },
  {
    name: 'shippings/shipping-methods',
    table: 'shipping_methods',
    deleted: 'inactive',
    module: shippingMethods,
    row: (id: number, status: string) => ({ id, status, name: `method-${id}`, base_rate: 500 }),
    live: 'active',
  },
  {
    name: 'shippings/shipping-zones',
    table: 'shipping_zones',
    deleted: 'inactive',
    module: shippingZones,
    row: (id: number, status: string) => ({ id, status, name: `zone-${id}` }),
    live: 'active',
  },
] as const

async function statusOf(table: string, id: number): Promise<unknown> {
  const row = await db.selectFrom(table).selectAll().where('id', '=', id).executeTakeFirst() as Record<string, unknown> | undefined
  return row?.status
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

  for (const { name, table, deleted, live, module, row } of MODULES) {
    await check(`${name} soft delete counts rows already in the target state`, async () => {
      for (const [id, status] of [[1, deleted], [2, live], [3, deleted], [4, live]] as Array<[number, string]>)
        await db.insertInto(table).values(row(id, status)).execute()

      // The row is already soft-deleted. MySQL changed nothing, so the UPDATE
      // reported 0 and this used to answer false.
      assert.equal(await module.softDelete(1), true, `${dialect}: soft-deleting an already soft-deleted row must report success`)
      assert.equal(await statusOf(table, 1), deleted, 'the row is still there, still soft-deleted')

      assert.equal(await module.softDelete(2), true, `${dialect}: soft-deleting a live row must report success`)
      assert.equal(await statusOf(table, 2), deleted)

      // 3 is already soft-deleted and 4 is live, so a MySQL CHANGED count is 1.
      assert.equal(await module.bulkSoftDelete([3, 4]), 2, `${dialect}: bulk soft delete must count rows already in the target state`)
      assert.equal(await statusOf(table, 3), deleted)
      assert.equal(await statusOf(table, 4), deleted)

      // An id nothing matches is still false, which is the distinction the
      // affected-row count could not draw on MySQL.
      assert.equal(await module.softDelete(404), false, `${dialect}: soft-deleting a row that does not exist must report failure`)
      assert.equal(await module.bulkSoftDelete([404, 405]), 0)
    })
  }

  // The clock stops here so "within the same second" is a fact rather than a
  // race: both writes below put `formatDate(new Date())` into `updated_at`,
  // and with the clock moving the second can tick between them and hide the
  // defect. bun:test's setSystemTime works in a plain `bun` run too.
  const { setSystemTime } = await import('bun:test')
  setSystemTime(new Date('2030-01-02T03:04:05.000Z'))
  try {
    await check('gift card deactivate is idempotent within one second', async () => {
      await db.insertInto('gift_cards').values({ id: 1, code: 'GC-1', initial_balance: 5000, current_balance: 5000, status: 'ACTIVE' }).execute()

      assert.equal(await deactivateGiftCard(1), true, `${dialect}: deactivating an active gift card must report success`)
      // Same second, same values: MySQL changed nothing and reported 0, so
      // this answered false for a card that is deactivated exactly as asked.
      assert.equal(await deactivateGiftCard(1), true, `${dialect}: deactivating an already deactivated gift card must report success`)
      assert.equal(await statusOf('gift_cards', 1), 'DEACTIVATED')
    })

    await check('variant updateStatus reports success for the status it already has', async () => {
      await db.insertInto('product_variants').values({ id: 1, variant: 'Size', type: 'dropdown', status: 'active' }).execute()
      await db.insertInto('product_variants').values({ id: 2, variant: 'Colour', type: 'dropdown', status: 'draft' }).execute()

      // The first call still writes `updated_at`, which is a change even when
      // the status is not, so it is the SECOND that is the true no-op and the
      // one MySQL reported as zero.
      assert.equal(await updateVariantStatus(1, 'active'), true, `${dialect}: re-applying a variant's current status must report success`)
      assert.equal(await updateVariantStatus(1, 'active'), true, `${dialect}: re-applying it again in the same second must report success`)
      assert.equal(await updateVariantStatus(2, 'active'), true, `${dialect}: changing a variant's status must report success`)
      assert.equal(await statusOf('product_variants', 2), 'active')
      assert.equal(await updateVariantStatus(404, 'active'), false, `${dialect}: a variant that does not exist must report failure`)
    })

    await check('variant bulkUpdate counts rows already holding the values', async () => {
      // Re-saving the two variants exactly as they now stand. Every column in
      // the SET, `updated_at` included, already holds what is being written,
      // so MySQL changed nothing and counted nothing.
      const rows = await db.selectFrom('product_variants').selectAll().where('id', 'in', [1, 2]).execute() as Array<Record<string, unknown>>
      assert.equal(rows.length, 2)

      const resaved = await bulkUpdateVariants(rows.map(row => ({ id: row.id, status: row.status })) as never)
      assert.equal(resaved, 2, `${dialect}: bulk update must count rows that already hold the values written`)
    })

    await check('cart bulkUpdate counts rows already holding the values, inside a transaction', async () => {
      // bulkUpdate runs its writes through `db.transaction`, so this is also
      // the check that reading the matched ids works on a transaction handle
      // and not only on `db`.
      for (const id of [1, 2])
        await db.insertInto('carts').values({ id, status: 'active', expires_at: '2030-02-01 00:00:00', applied_coupon_id: 'none' }).execute()

      const rows = [{ id: 1, status: 'active' }, { id: 2, status: 'active' }]
      // The first pass still writes `updated_at`; the second changes nothing.
      assert.equal(await bulkUpdateCarts(rows as never), 2)
      assert.equal(await bulkUpdateCarts(rows as never), 2, `${dialect}: bulk update must count carts that already hold the values written`)
    })

    await check('shipping rate updateByZone counts rates already at that rate', async () => {
      // A predicate that is not the primary key, matching more than one row.
      for (const id of [1, 2])
        await db.insertInto('shipping_rates').values({ id, weight_from: 0, weight_to: 10, rate: 250, shipping_zone_id: 7 }).execute()

      assert.equal(await updateRatesByZone(7, { rate: 250 } as never), 2)
      assert.equal(await updateRatesByZone(7, { rate: 250 } as never), 2, `${dialect}: updateByZone must count rates already at the requested rate`)
    })

    await check('product bulkUpdate counts rows already holding the values', async () => {
      for (const id of [1, 2])
        await db.insertInto('products').values({ id, name: `product-${id}`, price: 100, preparation_time: 5 }).execute()

      const rows = [{ id: 1, name: 'product-1' }, { id: 2, name: 'product-2' }]
      assert.equal(await bulkUpdateItems(rows as never), 2)
      assert.equal(await bulkUpdateItems(rows as never), 2, `${dialect}: bulk update must count products that already hold the values written`)
    })

    await check('product unit bulkUpdate counts rows already holding the values', async () => {
      for (const id of [1, 2])
        await db.insertInto('product_units').values({ id, name: `unit-${id}`, abbreviation: `u${id}`, type: 'weight' }).execute()

      const rows = [{ id: 1, name: 'unit-1' }, { id: 2, name: 'unit-2' }]
      assert.equal(await bulkUpdateUnits(rows as never), 2)
      assert.equal(await bulkUpdateUnits(rows as never), 2, `${dialect}: bulk update must count units that already hold the values written`)
    })
  }
  finally { setSystemTime() }

  assert.deepEqual(failures, [], `${dialect}: every write must report the rows its predicate matched`)
  console.log('commerce soft delete counts OK')
}
finally { resetDatabaseConnection() }
