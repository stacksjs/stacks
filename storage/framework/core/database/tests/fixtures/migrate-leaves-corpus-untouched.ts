import assert from 'node:assert/strict'
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// `buddy migrate` adapts migrations to the connected database: Postgres makes
// ALTERs idempotent, SQLite drops what it cannot run. It must do that to the
// run's copy, never to the committed files (stacksjs/stacks#2929).
const dialect = process.env.DB_CONNECTION as 'postgres' | 'sqlite'
const root = process.cwd()
const corpus = join(root, 'database/migrations')
mkdirSync(corpus, { recursive: true })

// Hand-written in SQLite's dialect, as the reporting app's are.
const files: Record<string, string> = {
  '0000000001-create-log-entries.sql': '-- Hand-written in SQLite dialect.\nCREATE TABLE IF NOT EXISTS "log_entries" ("id" INTEGER PRIMARY KEY, "message" TEXT);\n',
  '0000000002-add-trace-columns.sql': '-- Hand-written in SQLite dialect.\nALTER TABLE "log_entries" ADD COLUMN "trace_id" varchar(64);\nALTER TABLE "log_entries" ADD COLUMN "request_id" varchar(64);\n',
  // A column that is already gone: SQLite preprocessing drops this statement.
  '0000000003-drop-legacy.sql': '-- Hand-written in SQLite dialect.\nALTER TABLE "log_entries" DROP COLUMN "legacy_flag";\nALTER TABLE "log_entries" ADD COLUMN "level" TEXT;\n',
}
for (const [name, sql] of Object.entries(files))
  writeFileSync(join(corpus, name), sql)

const snapshot = () => Object.fromEntries(readdirSync(corpus).sort().map(name => [name, readFileSync(join(corpus, name), 'utf8')]))
const before = snapshot()

const { overridesReady } = await import('@stacksjs/config')
await overridesReady
const { ensureDatabaseConfigLoaded, initializeDbConfig, resetDatabaseConnection } = await import('../../src/utils')
await ensureDatabaseConfigLoaded()
const { DB_DATABASE: name, DB_HOST: host, DB_PORT: port, DB_USERNAME: username, DB_PASSWORD: password } = process.env
initializeDbConfig({
  app: { env: 'test' },
  database: dialect === 'postgres'
    ? { default: 'postgres', connections: { postgres: { name, host, port: Number(port), username, password } }, models: { includeFrameworkDefaults: false }, queryLogging: { enabled: false } }
    : { default: 'sqlite', connections: { sqlite: { database: join(root, 'app.sqlite') } }, models: { includeFrameworkDefaults: false }, queryLogging: { enabled: false } },
} as any)
const { runDatabaseMigration } = await import('../../src/migrations')

try {
  for (const pass of ['first', 'again']) {
    const result = await runDatabaseMigration()
    assert(result.isOk, `${pass}: ${result.isErr ? result.error.message : ''}`)
    // Byte for byte, and no file added, removed or renamed.
    assert.deepEqual(snapshot(), before, `${pass} migrate changed the committed corpus`)
  }

  const { db } = await import('../../src/utils')
  const columns = dialect === 'postgres'
    ? (await db.unsafe(`SELECT column_name AS name FROM information_schema.columns WHERE table_name = 'log_entries'`).execute() as Array<{ name: string }>).map(row => row.name)
    : (await db.unsafe(`SELECT name FROM pragma_table_info('log_entries')`).execute() as Array<{ name: string }>).map(row => row.name)
  for (const column of ['trace_id', 'request_id', 'level'])
    assert(columns.includes(column), `${column} was not applied: ${columns.join(', ')}`)

  // The run's copy is gone, so nothing lingers beside the corpus either.
  const runtime = join(root, 'storage/framework/runtime/migrations')
  let leftovers: string[] = []
  try { leftovers = readdirSync(runtime) } catch {}
  assert.deepEqual(leftovers, [])

  console.log(`committed corpus untouched by ${dialect} migrate`)
}
finally { resetDatabaseConnection() }
