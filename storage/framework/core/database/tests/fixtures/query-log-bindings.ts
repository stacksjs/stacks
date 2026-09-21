import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import process from 'node:process'

const dialect = process.env.DB_CONNECTION
assert(dialect === 'sqlite' || dialect === 'postgres' || dialect === 'mysql')
const configPath = process.env.STACKS_QUERY_LOG_BINDINGS_CONFIG
assert(configPath && basename(dirname(configPath)).startsWith('stacks-query-log-bindings-'))
if (dialect === 'sqlite')
  assert.equal(dirname(process.env.DB_DATABASE_PATH!), dirname(configPath))
else {
  assert.equal(process.env.DB_DATABASE_PATH, ':memory:')
  assert(process.env.DB_DATABASE?.startsWith('stacks_query_log_bindings_'))
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(process.env.DB_HOST!))
}

const { config, overridesReady } = await import('@stacksjs/config')
await overridesReady
const { db, ensureDatabaseConfigLoaded, initializeDbConfig, resetDatabaseConnection } = await import('../../src/utils')
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test' }, database: {
  default: dialect,
  connections: dialect === 'sqlite' ? { sqlite: { database: process.env.DB_DATABASE_PATH } } : {
    [dialect]: { name: process.env.DB_DATABASE, host: process.env.DB_HOST, port: Number(process.env.DB_PORT), username: process.env.DB_USERNAME, password: process.env.DB_PASSWORD },
  },
  queryLogging: { enabled: true },
} })

// query_logs as the model defines it, for this dialect.
const { buildMigrationPlan, generateSql, loadModels } = await import('bun-query-builder')
const plan = buildMigrationPlan(await loadModels({ modelsDir: join(import.meta.dir, '../../../../defaults/app/Models') }), { dialect })
plan.tables = plan.tables.filter(table => table.table === 'query_logs')
assert.equal(plan.tables.length, 1)
for (const column of plan.tables[0]!.columns)
  delete column.references
const scratch = mkdtempSync(join(tmpdir(), 'stacks-query-log-bindings-sql-'))
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

// Only what the logger keeps of the bindings is under test, so everything else
// is pinned.
config.database.queryLogging = {
  ...config.database.queryLogging,
  enabled: true,
  excludedQueries: ['query_logs'],
  analysis: { enabled: false, analyzeAll: false, explainPlan: false, suggestions: false },
}

// Shaped like what the framework really binds: session-auth ids are 64 hex
// characters, magic-link tokens 43 base64url ones.
const SESSION_ID = 'c0ffee00deadbeef'.repeat(4)
const MAGIC_LINK_TOKEN = 'Zq7xT2mN9pL4vR8sK1wY6bH3jF5cD0gA-u_EeIiOo2k'
const PASSWORD_HASH = '$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW'
const PLAIN_PASSWORD = 'correct horse battery staple'
const REMEMBER_TOKEN = 'remember me'
// Neither its column nor its shape gives this one away: only its JSON key does.
const SETTINGS_API_KEY = 'plain-api-key'
const secrets = { SESSION_ID, MAGIC_LINK_TOKEN, PASSWORD_HASH, PLAIN_PASSWORD, REMEMBER_TOKEN, SETTINGS_API_KEY }

interface LogRow { query: string, bindings: string | null }

/** The persisted row whose SQL, unquoted and lowercased, matches `shape`. */
function logged(rows: LogRow[], shape: RegExp): LogRow {
  const matches = rows.filter(row => shape.test(String(row.query).replace(/["`]/g, '').toLowerCase()))
  assert.equal(matches.length, 1, `expected one logged query like ${shape}, found ${matches.length}: ${JSON.stringify(rows.map(row => row.query))}`)
  return matches[0]!
}

function bindingsOf(row: LogRow): unknown {
  return row.bindings === null ? null : JSON.parse(row.bindings)
}

try {
  for (const statement of statements)
    await db.unsafe(statement).execute()
  const text = dialect === 'mysql' ? 'VARCHAR(255)' : 'TEXT'
  await db.unsafe(`CREATE TABLE sessions (id ${text} PRIMARY KEY, user_id INTEGER, ip_address ${text}, expires_at ${text})`).execute()
  await db.unsafe(`CREATE TABLE people (id INTEGER PRIMARY KEY, name ${text}, email ${text}, password ${text}, remember_token ${text}, status ${text}, settings ${text})`).execute()

  await db.insertInto('sessions').values({ id: SESSION_ID, user_id: 7, ip_address: '10.0.0.1', expires_at: '2026-09-22 00:00:00' }).execute()
  await db.selectFrom('sessions').where('id', '=', SESSION_ID).selectAll().executeTakeFirst()
  await db.insertInto('people').values({ id: 1, name: 'Ada Lovelace', email: 'ada@example.com', password: PASSWORD_HASH, remember_token: REMEMBER_TOKEN, status: 'active' }).execute()
  await db.updateTable('people').set({ password: PLAIN_PASSWORD }).where('id', '=', 1).execute()
  await db.updateTable('people').set({ settings: JSON.stringify({ theme: 'dark', api_key: SETTINGS_API_KEY }) }).where('id', '=', 1).execute()
  // Nothing about this column is sensitive: only the value's shape gives it away.
  await db.selectFrom('people').where('name', '=', MAGIC_LINK_TOKEN).selectAll().execute()
  await db.selectFrom('people').where('status', '=', 'active').where('id', 'in', [1, 2, 3]).selectAll().execute()
  await db.selectFrom('people').where('email', '=', 'ada@example.com').selectAll().execute()

  // Query logs are written in the background; wait for all eight.
  let rows: LogRow[] = []
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    rows = (await db.unsafe('SELECT query, bindings FROM query_logs').execute() as unknown as LogRow[])
      .filter(row => /\b(?:sessions|people)\b/.test(String(row.query)) && !/^\s*create/i.test(String(row.query)))
    if (rows.length >= 8)
      break
    await Bun.sleep(25)
  }

  for (const [label, secret] of Object.entries(secrets)) {
    const leaked = rows.find(row => `${row.query}\n${row.bindings}`.includes(secret))
    assert(!leaked, `${label} was persisted verbatim in query_logs: ${leaked?.query} ${leaked?.bindings}`)
  }

  assert.deepEqual(bindingsOf(logged(rows, /^select \* from sessions where id = /)), ['<redacted>'])
  assert.deepEqual(bindingsOf(logged(rows, /^insert into sessions/)), ['<redacted>', 7, '<redacted>', '<redacted>'])
  assert.deepEqual(bindingsOf(logged(rows, /^insert into people/)), [1, 'Ada Lovelace', 'ada@example.com', '<redacted>', '<redacted>', 'active'])
  assert.deepEqual(bindingsOf(logged(rows, /^update people set password = /)), ['<redacted>', 1])
  assert.deepEqual(bindingsOf(logged(rows, /^update people set settings = /)), ['<redacted>', 1])
  assert.deepEqual(bindingsOf(logged(rows, /^select \* from people where name = /)), ['<redacted>'])
  // Benign values stay, so the log is still worth reading while debugging.
  assert.deepEqual(bindingsOf(logged(rows, /^select \* from people where status = /)), ['active', 1, 2, 3])
  assert.deepEqual(bindingsOf(logged(rows, /^select \* from people where email = /)), ['ada@example.com'])

  console.log('query log bindings OK')
}
finally {
  resetDatabaseConnection()
}
