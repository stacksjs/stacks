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
const { db, ensureDatabaseConfigLoaded, initializeDbConfig, resetDatabaseConnection } = await import('@stacksjs/database')
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
const TABLES = ['carts', 'receipts']
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

const { cleanupAbandonedCarts } = await import('../../orders/guards')
const { bulkStore } = await import('../../receipts/store')

async function count(table: string): Promise<number> {
  return (await db.selectFrom(table).selectAll().execute() as unknown[]).length
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

  await check('receipts bulkStore', async () => {
    const receipt = (index: number) => ({ printer: 'Front Counter', document: `Receipt #${index}`, timestamp: Date.parse('2026-01-10T12:00:00Z'), status: 'success', size: 12, pages: 1, duration: 2 })
    const before = await count('receipts')
    const reported = await bulkStore([receipt(1), receipt(2), receipt(3)] as never)
    const inserted = await count('receipts') - before
    assert.equal(inserted, 3, 'the three receipts were inserted')
    assert.equal(reported, inserted, `bulkStore reported ${reported} but inserted ${inserted} receipts`)
  })

  assert.deepEqual(failures, [], `${dialect}: every commerce write must report the rows it changed`)
  console.log('commerce write counts OK')
}
finally { resetDatabaseConnection() }
