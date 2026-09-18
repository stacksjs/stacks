import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import process from 'node:process'

const dialect = process.env.DB_CONNECTION
assert(dialect === 'sqlite' || dialect === 'postgres' || dialect === 'mysql')
const configPath = process.env.STACKS_CAMPAIGN_TRANSITIONS_CONFIG
assert(configPath && basename(dirname(configPath)).startsWith('stacks-campaign-transitions-'))
if (dialect === 'sqlite')
  assert.equal(dirname(process.env.DB_DATABASE_PATH!), dirname(configPath))
else {
  assert.equal(process.env.DB_DATABASE_PATH, ':memory:')
  assert(process.env.DB_DATABASE?.startsWith('stacks_campaign_transitions_'))
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(process.env.DB_HOST!))
}
const { overridesReady } = await import('@stacksjs/config')
await overridesReady
const { db, ensureDatabaseConfigLoaded, initializeDbConfig, resetDatabaseConnection, sqlDateTime } = await import('@stacksjs/database')
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test' }, database: {
  default: dialect,
  connections: dialect === 'sqlite' ? { sqlite: { database: process.env.DB_DATABASE_PATH } } : {
    [dialect]: { name: process.env.DB_DATABASE, host: process.env.DB_HOST, port: Number(process.env.DB_PORT), username: process.env.DB_USERNAME, password: process.env.DB_PASSWORD },
  },
  queryLogging: { enabled: false },
} })

// The campaigns table as the model defines it, for this dialect.
const { buildMigrationPlan, generateSql, loadModels } = await import('bun-query-builder')
const models = await loadModels({ modelsDir: join(import.meta.dir, '../../../../defaults/app/Models') })
const plan = buildMigrationPlan(models, { dialect })
plan.tables = plan.tables.filter(table => table.table === 'campaigns')
assert.equal(plan.tables.length, 1)
for (const column of plan.tables[0].columns)
  delete column.references
const scratch = mkdtempSync(join(tmpdir(), 'stacks-campaign-transitions-sql-'))
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

const { campaignDeliverySnapshot, campaigns } = await import('../../src/campaigns')

async function seed(status: string, updatedAt: string | null, scheduledAt: string | null): Promise<number> {
  await db.insertInto('campaigns').values({
    uuid: crypto.randomUUID(), name: `campaign-${status}`, type: 'email', status,
    scheduled_at: scheduledAt, created_at: sqlDateTime(), updated_at: updatedAt,
  } as never).execute()
  const rows = await db.selectFrom('campaigns').selectAll().execute() as Array<{ id: number }>
  return Number(rows[rows.length - 1].id)
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

  // The compare-and-set matches on the timestamps this snapshot carries, so
  // they have to come back in the format the column was written in. MySQL
  // hands these columns back as Date objects, and a stringified Date is not a
  // datetime any of these databases accept.
  await check('snapshot timestamps stay in the stored format', async () => {
    const id = await seed('scheduled', sqlDateTime(), sqlDateTime())
    const snapshot = campaignDeliverySnapshot(await campaigns.find(id))
    for (const [field, value] of [['updatedAt', snapshot.updatedAt], ['scheduledAt', snapshot.scheduledAt]] as const) {
      assert(value, `${field} should be present`)
      assert.match(value!, /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}/, `${dialect}: ${field} is "${value}"`)
    }
  })

  await check('cancel a scheduled campaign that carries both timestamps', async () => {
    const id = await seed('scheduled', sqlDateTime(), sqlDateTime())
    const after = await campaigns.cancel(id)
    assert.equal((after as Record<string, unknown> | undefined)?.status, 'cancelled')
  })

  await check('cancel a campaign whose updated_at is null', async () => {
    const id = await seed('scheduled', null, sqlDateTime())
    await campaigns.cancel(id)
    const row = await db.selectFrom('campaigns').selectAll().where('id', '=', id).executeTakeFirst() as Record<string, unknown>
    assert.equal(row.status, 'cancelled')
  })

  // The compare-and-set has to match the row it snapshotted and write the
  // target state onto it, leaving the rest of the row alone.
  await check('the transition writes the target state onto the matched row', async () => {
    const seeded = '2020-01-01T00:00:00.000'
    const scheduled = '2020-06-01T12:00:00.000'
    const id = await seed('scheduled', seeded, scheduled)
    await campaigns.cancel(id)
    const row = await db.selectFrom('campaigns').selectAll().where('id', '=', id).executeTakeFirst() as Record<string, unknown>
    assert.equal(row.status, 'cancelled')
    assert.equal(campaignDeliverySnapshot(row).scheduledAt?.slice(0, 19), scheduled.slice(0, 19), 'scheduled_at is carried over unchanged')
    assert.notEqual(campaignDeliverySnapshot(row).updatedAt?.slice(0, 19), seeded.slice(0, 19), 'updated_at is stamped by the transition')
  })

  assert.deepEqual(failures, [], `${dialect}: campaign delivery transitions must run`)
  console.log('campaign transitions OK')
}
finally { resetDatabaseConnection() }
