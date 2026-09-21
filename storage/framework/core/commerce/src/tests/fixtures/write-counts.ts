import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import process from 'node:process'

const dialect = process.env.DB_CONNECTION
assert(dialect === 'sqlite' || dialect === 'postgres' || dialect === 'mysql')
const configPath = process.env.STACKS_COMMERCE_WRITE_COUNTS_CONFIG
assert(configPath && basename(dirname(configPath)).startsWith('stacks-commerce-write-counts-'))
if (dialect === 'sqlite')
  assert.equal(dirname(process.env.DB_DATABASE_PATH!), dirname(configPath))
else {
  assert.equal(process.env.DB_DATABASE_PATH, ':memory:')
  assert(process.env.DB_DATABASE?.startsWith('stacks_commerce_write_counts_'))
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(process.env.DB_HOST!))
}
const { overridesReady } = await import('@stacksjs/config')
await overridesReady
const { Database } = await import('bun:sqlite')
const { db, ensureDatabaseConfigLoaded, initializeDbConfig, resetDatabaseConnection, sqlDateTime } = await import('@stacksjs/database')
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test' }, database: {
  default: dialect,
  connections: dialect === 'sqlite' ? { sqlite: { database: process.env.DB_DATABASE_PATH } } : {
    [dialect]: { name: process.env.DB_DATABASE, host: process.env.DB_HOST, port: Number(process.env.DB_PORT), username: process.env.DB_USERNAME, password: process.env.DB_PASSWORD },
  },
  queryLogging: { enabled: false },
} })

// The schema comes from the model definitions, as the package's SQLite harness
// (../setup.ts) builds it, but for this dialect and only the tables under test.
const TABLES = ['carts', 'categories', 'coupons', 'gift_cards', 'payments', 'receipts']
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
const scratch = mkdtempSync(join(tmpdir(), 'stacks-commerce-write-counts-sql-'))
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

const { deactivate, deactivateChildCategories } = await import('../../products/categories/destroy')
const { registerPersistentQueryHooks } = await import('@stacksjs/query-builder')
const { redeem } = await import('../../coupons/update')
const { store: storeCoupon } = await import('../../coupons/store')
const { updateBalance } = await import('../../gift-cards/update')
const { store: storeGiftCard } = await import('../../gift-cards/store')
const { cleanupAbandonedCarts } = await import('../../orders/guards')
const { recordRefund } = await import('../../payments/update')
const { store: storePayment } = await import('../../payments/store')
const { bulkStore } = await import('../../receipts/store')

async function count(table: string): Promise<number> {
  return (await db.selectFrom(table).selectAll().execute() as unknown[]).length
}
async function column(table: string, id: unknown, name: string): Promise<unknown> {
  const row = await db.selectFrom(table).selectAll().where('id', '=', id).executeTakeFirst() as Record<string, unknown> | undefined
  return row?.[name]
}

/**
 * Delete a category on a SECOND connection, synchronously, so it commits while
 * a query hook holds the pending UPDATE. bun:sqlite is synchronous in process;
 * the server dialects get a short-lived child process, as
 * auth/tests/fixtures/session-refresh-mysql.ts does.
 */
function deleteOnAnotherConnection(id: number): boolean {
  if (dialect === 'sqlite') {
    const handle = new Database(process.env.DB_DATABASE_PATH!)
    try { handle.run('DELETE FROM categories WHERE id = ?', [id]) }
    finally { handle.close() }
    return true
  }
  const adapter = dialect === 'postgres' ? 'postgres' : 'mysql'
  const child = Bun.spawnSync([process.execPath, '-e', `
    const db = new Bun.SQL({ adapter: '${adapter}', hostname: process.env.DB_HOST,
      port: Number(process.env.DB_PORT), database: process.env.DB_DATABASE,
      username: process.env.DB_USERNAME, password: process.env.DB_PASSWORD,
      tls: process.env.DB_SSL === 'true' ? 'require' : 'disable' })
    try { await db.unsafe('DELETE FROM categories WHERE id = ${id}') }
    finally { await db.close() }
  `], { cwd: tmpdir(), env: process.env, stdout: 'pipe', stderr: 'pipe', timeout: 5000 })
  if (child.exitCode !== 0)
    console.error(new TextDecoder().decode(child.stderr))
  return child.exitCode === 0
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

  const today = new Date()

  await check('orders cleanupAbandonedCarts', async () => {
    const old = '2020-01-01 00:00:00'
    const fresh = today.toISOString().slice(0, 19).replace('T', ' ')
    for (const [index, updatedAt] of [old, old, fresh].entries())
      await db.insertInto('carts').values({ uuid: `cart-${index}`, applied_coupon_id: '', expires_at: updatedAt, created_at: updatedAt, updated_at: updatedAt } as never).execute()
    const before = await count('carts')
    const { deleted } = await cleanupAbandonedCarts({ olderThanDays: 30 })
    const removed = before - await count('carts')
    assert.equal(removed, 2, 'the two abandoned carts were deleted')
    assert.equal(deleted, removed, `cleanupAbandonedCarts reported ${deleted} but removed ${removed} carts`)
  })

  await check('coupons redeem', async () => {
    const today = new Date()
    const day = (offset: number) => new Date(today.getTime() + offset * 86_400_000).toISOString().slice(0, 10)
    const coupon = await storeCoupon({ code: `REDEEM-${dialect}`, discount_type: 'percentage', discount_value: 10, product_id: 1, start_date: day(-1), end_date: day(30), is_active: true, usage_limit: 2 } as never)
    assert(coupon?.id, 'seed coupon')
    const id = Number(coupon.id)

    const first = await redeem(id)
    assert.equal(Number(await column('coupons', id, 'usage_count')), 1, 'the redemption was committed')
    assert.equal(first.ok, true, `redeem reported ${JSON.stringify(first)} for a redemption it committed`)

    // The cap is the column the schema has, so the third attempt must fail.
    assert.equal((await redeem(id)).ok, true)
    const third = await redeem(id)
    assert.equal(third.ok, false)
    assert.equal(third.ok === false && third.reason, 'limit-reached')
    assert.equal(Number(await column('coupons', id, 'usage_count')), 2, 'a rejected redemption must not count')
  })

  // Both run a guarded UPDATE whose `status` is a CASE over string literals. On
  // PostgreSQL `status` is an enum type, and a CASE of literals is text.
  await check('gift cards updateBalance', async () => {
    const card = await storeGiftCard({ code: `GC-WRITE-COUNTS-${dialect}`, initial_balance: 100, current_balance: 100, currency: 'USD', status: 'ACTIVE', is_active: true } as never)
    assert(card?.id, 'seed gift card')
    const spent = await updateBalance(Number(card.id), -40)
    assert.equal(Number(await column('gift_cards', card.id, 'current_balance')), 60)
    assert.equal(Number((spent as Record<string, unknown> | undefined)?.current_balance), 60)
    // Spending the rest has to flip the status, which is what the CASE is for.
    const used = await updateBalance(Number(card.id), -60)
    assert.equal(await column('gift_cards', card.id, 'status'), 'USED')
    assert.equal(used?.status, 'USED')
    await assert.rejects(updateBalance(Number(card.id), -1), /not active/, 'a spent card rejects another redemption')
  })

  // A zero adjustment writes exactly what the card holds once `updated_at` is
  // in the same second, so on MySQL, which counts rows CHANGED, the UPDATE
  // reported zero rows although it matched the card. Every guard in the
  // diagnosis then passed, and it fell through to "Insufficient gift card
  // balance" for a card holding 100 (stacksjs/stacks#2639).
  await check('gift cards updateBalance by zero', async () => {
    const card = await storeGiftCard({ code: `GC-ZERO-${dialect}`, initial_balance: 100, current_balance: 100, currency: 'USD', status: 'ACTIVE', is_active: true } as never)
    assert(card?.id, 'seed gift card')
    const { setSystemTime } = await import('bun:test')
    setSystemTime(new Date('2030-01-02T03:04:05.000Z'))
    try {
      // The first stamps updated_at; the second is the true no-op.
      await updateBalance(Number(card.id), 0)
      const again = await updateBalance(Number(card.id), 0)
      assert.equal(Number((again as Record<string, unknown> | undefined)?.current_balance), 100, `${dialect}: a zero adjustment must return the card unchanged`)
      // Zero is the only amount that can leave a matched card unchanged, so it
      // is the only one the diagnosis may accept. An over-spend is still refused.
      await assert.rejects(updateBalance(Number(card.id), -1000), /Insufficient/, 'an over-spend is still insufficient')
      assert.equal(Number(await column('gift_cards', card.id, 'current_balance')), 100)
    }
    finally { setSystemTime() }
  })

  // An expired card is refused by the UPDATE's own guard on every dialect,
  // and the diagnosis that follows must say why. It compared `String(expiry)`
  // to a formatted timestamp, and PostgreSQL and MySQL hand the column back as
  // a Date: "Wed Jan 01 2020 ..." starts with a letter, which sorts after any
  // digit, so the expiry was never detected there. A redemption was reported
  // as an insufficient balance, and a zero adjustment - which the diagnosis
  // accepts once every guard it can see has held - as a success.
  await check('gift cards updateBalance on an expired card', async () => {
    const card = await storeGiftCard({ code: `GC-EXPIRED-${dialect}`, initial_balance: 100, current_balance: 100, currency: 'USD', status: 'ACTIVE', is_active: true, expiry_date: '2020-01-01 00:00:00' } as never)
    assert(card?.id, 'seed gift card')
    await assert.rejects(updateBalance(Number(card.id), -10), /expired/, `${dialect}: a redemption on an expired card must say it expired`)
    await assert.rejects(updateBalance(Number(card.id), 0), /expired/, `${dialect}: a zero adjustment on an expired card must be refused, not reported as success`)
    assert.equal(Number(await column('gift_cards', card.id, 'current_balance')), 100)
  })

  await check('payments recordRefund', async () => {
    const payment = await storePayment({ amount: 1000, method: 'creditCard', status: 'completed', transaction_id: `TXN-WRITE-COUNTS-${dialect}` } as never)
    assert(payment?.id, 'seed payment')
    const partial = await recordRefund(Number(payment.id), 250)
    assert.equal(Number(await column('payments', payment.id, 'refund_amount')), 250)
    assert.equal(partial.status, 'partiallyRefunded')
    const full = await recordRefund(Number(payment.id), 750)
    assert.equal(await column('payments', payment.id, 'status'), 'refunded')
    assert.equal(full.status, 'refunded')
    await assert.rejects(recordRefund(Number(payment.id), 1), /cannot be refunded/, 'a fully refunded payment rejects another refund')
  })

  await check('product categories deactivate', async () => {
    // Seeded directly rather than through categories/store.ts, which uses
    // returningAll() and therefore cannot run on MySQL (stacksjs/stacks#2637).
    let next = 0
    const seedCategory = async (name: string, parentId: number | null) => {
      next += 1
      await db.insertInto('categories').values({
        uuid: crypto.randomUUID(), name, slug: `${name}-${dialect}-${next}`, display_order: next,
        is_active: true, parent_category_id: parentId, created_at: sqlDateTime(), updated_at: sqlDateTime(),
      } as never).execute()
      const rows = await db.selectFrom('categories').selectAll().execute() as Array<{ id: number }>
      return Number(rows[rows.length - 1].id)
    }

    const id = await seedCategory('parent', null)
    assert.equal(await deactivate(id), true, 'deactivating a category that exists')
    assert.equal(Boolean(await column('categories', id, 'is_active')), false)
    // Twice in a row writes the same values, which MySQL counts as zero rows
    // changed. The row is still there, so this is still a success.
    assert.equal(await deactivate(id), true, 'deactivating a category that is already inactive')

    for (const child of ['a', 'b'])
      await seedCategory(`child-${child}`, id)
    // The repeat writes values both children already hold - is_active false,
    // and a second-precision updated_at in the same second - so MySQL, which
    // counts rows CHANGED, reported 0 children deactivated where the other two
    // report 2 (stacksjs/stacks#2639). The clock is frozen so "the same
    // second" is a fact rather than a race.
    const { setSystemTime } = await import('bun:test')
    setSystemTime(new Date('2030-01-02T03:04:05.000Z'))
    try {
      assert.equal(await deactivateChildCategories(String(id)), 2)
      assert.equal(await deactivateChildCategories(String(id)), 2, `${dialect}: children that are already inactive are still the children deactivated`)
    }
    finally { setSystemTime() }

    // The reported race: the category is removed after deactivate() has
    // checked that it exists, and before its UPDATE lands. A result object is
    // truthy even for zero rows, so this used to report success.
    const doomed = await seedCategory('doomed', null)
    let removed = false
    const unregister = registerPersistentQueryHooks({
      onQueryStart(event: { kind?: string }) {
        // MySQL does not pass the SQL text through this hook
        // (stacksjs/bun-query-builder#1142), so match on the kind.
        if (event.kind !== 'update' || removed)
          return
        removed = deleteOnAnotherConnection(doomed)
      },
    })
    try {
      const claimed = await deactivate(doomed)
      assert.equal(removed, true, 'the competing delete must have run')
      assert.equal(claimed, false, `${dialect}: deactivate must not report success for a row that is gone`)
    }
    finally { unregister() }
    assert.equal(await db.selectFrom('categories').selectAll().where('id', '=', doomed).executeTakeFirst(), undefined)
  })

  await check('receipts bulkStore', async () => {
    const receipt = (index: number) => ({ printer: 'Front Counter', document: `Receipt #${index}`, timestamp: Date.parse('2026-01-10T12:00:00Z'), status: 'success', size: 12, pages: 1, duration: 2 })
    const before = await count('receipts')
    const reported = await bulkStore([receipt(1), receipt(2), receipt(3)] as never)
    const inserted = await count('receipts') - before
    assert.equal(inserted, 3, 'the three receipts were inserted')
    assert.equal(reported, inserted, `bulkStore reported ${reported} but inserted ${inserted} receipts`)
  })

  assert.deepEqual(failures, [], `${dialect}: every commerce write must apply and report the rows it changed`)
  console.log('commerce write counts OK')
}
finally { resetDatabaseConnection() }
