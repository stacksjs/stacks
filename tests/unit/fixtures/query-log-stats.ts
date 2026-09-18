import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import process from 'node:process'

const dialect = process.env.DB_CONNECTION
assert(dialect === 'sqlite' || dialect === 'postgres' || dialect === 'mysql')
const configPath = process.env.STACKS_QUERY_LOG_STATS_CONFIG
assert(configPath && basename(dirname(configPath)).startsWith('stacks-query-log-stats-'))
if (dialect === 'sqlite')
  assert.equal(dirname(process.env.DB_DATABASE_PATH!), dirname(configPath))
else {
  assert.equal(process.env.DB_DATABASE_PATH, ':memory:')
  assert(process.env.DB_DATABASE?.startsWith('stacks_query_log_stats_'))
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

// query_logs as the model defines it, for this dialect.
const { buildMigrationPlan, generateSql, loadModels } = await import('bun-query-builder')
const plan = buildMigrationPlan(await loadModels({ modelsDir: join(import.meta.dir, '../../../storage/framework/defaults/app/Models') }), { dialect })
plan.tables = plan.tables.filter(table => table.table === 'query_logs')
assert.equal(plan.tables.length, 1)
for (const column of plan.tables[0].columns)
  delete column.references
const scratch = mkdtempSync(join(tmpdir(), 'stacks-query-log-stats-sql-'))
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

const QueryController = (await import('../../../storage/framework/defaults/app/Controllers/QueryController')).default

const hour = 3_600_000

async function seed(): Promise<void> {
  await db.deleteFrom('query_logs').execute()
  const rows: Array<[string, string, number, string, number]> = [
    // tags, status, duration, label, hours ago
    ['["select"]', 'completed', 10, 'select-1', 1],
    ['["select"]', 'completed', 20, 'select-2', 1],
    ['["select"]', 'completed', 30, 'select-3', 2],
    ['["insert"]', 'slow', 100, 'insert-slow-1', 1],
    ['["insert"]', 'slow', 200, 'insert-slow-2', 2],
    // Outside the 24 hour window the stats timeline looks at, inside the
    // 30 day one the month timeframe looks at.
    ['["select"]', 'slow', 300, 'select-old', 48],
  ]
  for (const [tags, status, duration, label, hoursAgo] of rows) {
    const executedAt = sqlDateTime(new Date(Date.now() - hoursAgo * hour))
    await db.insertInto('query_logs').values({
      query: label, normalized_query: label, duration, connection: String(process.env.DB_CONNECTION),
      status, tags, executed_at: executedAt, created_at: executedAt, updated_at: executedAt,
    } as never).execute()
  }
}

const failures: string[] = []
async function check(name: string, run: () => Promise<void>) {
  try {
    await run()
    console.log(`PASS ${name}`)
  }
  catch (error) { failures.push(`${name}: ${error instanceof Error ? error.message : String(error)}`) }
}

const HOUR_LABEL = /^\d{4}-\d{2}-\d{2} \d{2}:00:00$/
const DAY_LABEL = /^\d{4}-\d{2}-\d{2}$/
const countOf = (rows: Array<{ count: number | string }>) => rows.reduce((total, row) => total + Number(row.count), 0)

try {
  for (const statement of statements)
    await db.unsafe(statement).execute()
  await seed()

  await check('getStats groups by query type and status', async () => {
    const stats = await new QueryController().getStats() as any
    assert.equal(Number(stats.totalQueries), 6)

    const byType = Object.fromEntries(stats.byType.map((row: any) => [row.type, Number(row.count)]))
    assert.deepEqual(byType, { select: 4, insert: 2 }, `byType was ${JSON.stringify(stats.byType)}`)

    const byStatus = Object.fromEntries(stats.byStatus.map((row: any) => [row.status, Number(row.count)]))
    assert.deepEqual(byStatus, { completed: 3, slow: 3 })

    // (10 + 20 + 30 + 300) / 4 for select, (100 + 200) / 2 for insert.
    const avg = Object.fromEntries(stats.avgDuration.map((row: any) => [row.type, Number(row.avg_duration)]))
    assert.equal(avg.select, 90)
    assert.equal(avg.insert, 150)
  })

  await check('getStats counts slow queries from the last 24 hours only', async () => {
    const stats = await new QueryController().getStats() as any
    assert.equal(countOf(stats.slowQueriesTimeline), 2, `timeline was ${JSON.stringify(stats.slowQueriesTimeline)}`)
    for (const row of stats.slowQueriesTimeline)
      assert.match(row.hour, HOUR_LABEL, 'the bucket keeps the shape the dashboard renders')
  })

  await check('getQueryTimeline buckets by hour over a day', async () => {
    const timeline = await new QueryController().getQueryTimeline({ timeframe: 'day', type: 'all' }) as any
    assert.equal(countOf(timeline.data), 5, `the 48 hour old row is outside the window: ${JSON.stringify(timeline.data)}`)
    for (const row of timeline.data)
      assert.match(row.time_interval, HOUR_LABEL)
  })

  await check('getQueryTimeline buckets by day over a month, and filters by type', async () => {
    const month = await new QueryController().getQueryTimeline({ timeframe: 'month', type: 'all' }) as any
    assert.equal(countOf(month.data), 6)
    for (const row of month.data)
      assert.match(row.time_interval, DAY_LABEL)

    const inserts = await new QueryController().getQueryTimeline({ timeframe: 'month', type: 'insert' }) as any
    assert.equal(countOf(inserts.data), 2, `type filter returned ${JSON.stringify(inserts.data)}`)
  })

  assert.deepEqual(failures, [], `${dialect}: query stats and timeline must read on every dialect`)
  console.log('query log stats OK')
}
finally { resetDatabaseConnection() }
