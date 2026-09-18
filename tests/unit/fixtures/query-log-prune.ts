import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import process from 'node:process'

const dialect = process.env.DB_CONNECTION
assert(dialect === 'sqlite' || dialect === 'postgres' || dialect === 'mysql')
const configPath = process.env.STACKS_QUERY_LOG_PRUNE_CONFIG
assert(configPath && basename(dirname(configPath)).startsWith('stacks-query-log-prune-'))
if (dialect === 'sqlite')
  assert.equal(dirname(process.env.DB_DATABASE_PATH!), dirname(configPath))
else {
  assert.equal(process.env.DB_DATABASE_PATH, ':memory:')
  assert(process.env.DB_DATABASE?.startsWith('stacks_query_log_prune_'))
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
const scratch = mkdtempSync(join(tmpdir(), 'stacks-query-log-prune-sql-'))
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

const RETENTION_DAYS = 7
const day = 86_400_000

async function seed(): Promise<void> {
  await db.deleteFrom('query_logs').execute()
  // Written the way the query logger writes them, so the comparison runs
  // against the stored format rather than a convenient one.
  const rows = [
    ['well-past-retention', sqlDateTime(new Date(Date.now() - 30 * day))],
    ['just-past-retention', sqlDateTime(new Date(Date.now() - RETENTION_DAYS * day - 60_000))],
    ['inside-retention', sqlDateTime(new Date())],
  ]
  for (const [query, executedAt] of rows) {
    await db.insertInto('query_logs').values({
      query, normalized_query: query, duration: 1, connection: String(process.env.DB_CONNECTION),
      status: 'completed', executed_at: executedAt, created_at: executedAt, updated_at: executedAt,
    } as never).execute()
  }
}

async function remaining(): Promise<string[]> {
  const rows = await db.selectFrom('query_logs').selectAll().execute() as Array<{ query: string }>
  return rows.map(row => row.query).sort()
}

try {
  for (const statement of statements)
    await db.unsafe(statement).execute()
  await seed()

  const result = await new QueryController().pruneQueryLogs()
  assert.equal(result.retentionDays, RETENTION_DAYS)
  assert.deepEqual(await remaining(), ['inside-retention'], `${dialect}: only rows inside the retention window survive`)
  assert.equal(result.pruned, 2, `${dialect}: pruneQueryLogs reported ${result.pruned} of 2 deleted rows`)

  // Nothing left to prune is a real zero.
  assert.equal((await new QueryController().pruneQueryLogs()).pruned, 0)
  console.log('query log prune OK')
}
finally { resetDatabaseConnection() }
