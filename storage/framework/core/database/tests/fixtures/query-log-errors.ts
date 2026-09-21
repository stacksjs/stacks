import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import process from 'node:process'

const dialect = process.env.DB_CONNECTION
assert(dialect === 'sqlite' || dialect === 'postgres' || dialect === 'mysql')
const appEnv = process.env.APP_ENV
assert(appEnv === 'test' || appEnv === 'production')
// What the runner expects the logger to keep of the values: `values` outside
// production, `types` in production.
const expected = process.env.STACKS_QUERY_LOG_BINDINGS_EXPECT
assert(expected === 'values' || expected === 'types')
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
const { MAX_QUERY_LOG_ERROR_LENGTH } = await import('../../src/query-log-bindings')
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: appEnv }, database: {
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
const scratch = mkdtempSync(join(tmpdir(), 'stacks-query-log-errors-sql-'))
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

// Only the capture policy is under test, so everything else is pinned, and
// captureBindings is left as the application config resolved it.
const queryLogging = config.database.queryLogging
assert(queryLogging, 'the database config has queryLogging')
config.database.queryLogging = {
  ...queryLogging,
  enabled: true,
  excludedQueries: ['query_logs'],
  analysis: { enabled: false, analyzeAll: false, explainPlan: false, suggestions: false },
}

// Each value below is looked for in what the drivers printed by a distinctive
// ASCII fragment, never by how a given server version prints the whole of it,
// so a server that cuts, escapes or quotes it differently still passes when
// the value is gone and fails when any recognisable part of it stays.

// Bound to a column named `token`, so its binding is redacted. MySQL 8.4 cuts
// a duplicate key at 64 bytes, so it prints only the start of this one.
const TOKEN = 'Zq7xT2mN9pL4vR8sK1wY6bH3jF5cD0gA-u_EeIiOo2k'.repeat(2)
// Bound to an ordinary integer column, which PostgreSQL and MySQL reject with
// the value in the message; its shape alone gets it redacted. MySQL 8.4
// prints the accented e as \xC3\xA9.
const BUILD_TOKEN = `café-${'c0ffee00deadbeef'.repeat(4)}`
// Nothing about this one is secret, so outside production it stays in the
// error. MySQL 8.4 prints its emoji as `?`.
const HANDLE = `ada \u{1F600} lovelace`
// A number in a column named `otp`: redacted where values are kept, and a
// number that must leave the error in production too, where it is a type.
const OTP = 482913

/** Every `size`-character piece of `text`. */
function pieces(text: string, size: number): string[] {
  return Array.from({ length: text.length - size + 1 }, (_, at) => text.slice(at, at + size))
}

interface LogRow { query: string, status: string, error: string | null, bindings: string | null }

async function failure(run: () => Promise<unknown>): Promise<string | undefined> {
  try {
    await run()
    return undefined
  }
  catch (error) {
    return String(error)
  }
}

try {
  for (const statement of statements)
    await db.unsafe(statement).execute()
  const text = dialect === 'mysql' ? 'VARCHAR(255)' : 'TEXT'
  await db.unsafe(`CREATE TABLE devices (id INTEGER PRIMARY KEY, token ${text}, handle ${text}, build INTEGER, otp INTEGER, UNIQUE (token), UNIQUE (handle), UNIQUE (otp))`).execute()

  await db.insertInto('devices').values({ id: 1, token: TOKEN, handle: HANDLE, otp: OTP }).execute()
  // One column each, so each failure is told apart by its SQL alone, types or not.
  const caught = {
    token: await failure(() => db.insertInto('devices').values({ id: 2, token: TOKEN }).execute()),
    handle: await failure(() => db.insertInto('devices').values({ id: 3, handle: HANDLE }).execute()),
    build: await failure(() => db.insertInto('devices').values({ id: 4, build: BUILD_TOKEN }).execute()),
    otp: await failure(() => db.insertInto('devices').values({ id: 5, otp: OTP }).execute()),
  }
  assert(caught.token && caught.handle && caught.otp, 'every duplicate must fail')
  // A failed query whose error can be longer than the limit. SQLite names a
  // missing table in full (Bun 1.4.1), and PostgreSQL 16 echoes in full a
  // value it cannot parse; MySQL 8.4 prints 100 characters of the name, so
  // there the error is short and kept whole.
  const LONG = 'q'.repeat(5000)
  const longError = await failure(() => dialect === 'postgres'
    ? db.selectFrom('devices').where('id', '=', LONG).selectAll().execute()
    : db.selectFrom(LONG).selectAll().execute())
  assert(longError, 'the long query must fail')
  if (dialect !== 'mysql')
    assert(longError.length > MAX_QUERY_LOG_ERROR_LENGTH && longError.includes(LONG), `${dialect} no longer prints the whole name or value: ${longError.length} characters`)
  // SQLite stores the text in an INTEGER column; the servers refuse it.
  assert.equal(caught.build === undefined, dialect === 'sqlite', `build: ${caught.build}`)

  /** A fragment of each value that says the driver printed it, as any server prints it. */
  const fragment = { token: TOKEN.slice(0, 16), build: 'c0ffee00deadbeef', handle: 'lovelace', otp: String(OTP) }
  const printed = (key: keyof typeof caught): boolean => caught[key]?.includes(fragment[key]) === true
  // The test is only worth something where a driver put values in its
  // messages. This depends on the servers: MySQL 8.4.5 printed the duplicate
  // token and the rejected build, PostgreSQL 16.14 the rejected build (it keeps
  // a duplicate key in the error's detail); SQLite prints neither.
  if (dialect === 'mysql')
    assert(printed('token') && printed('build'), `MySQL no longer prints the values: ${caught.token} / ${caught.build}`)
  if (dialect === 'postgres')
    assert(printed('build'), `PostgreSQL no longer prints the value: ${caught.build}`)

  // Query logs are written in the background; wait for every failure and
  // for the long query.
  const failures = Object.values(caught).filter(Boolean).length
  let all: LogRow[] = []
  let rows: LogRow[] = []
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    all = (await db.unsafe('SELECT query, status, error, bindings FROM query_logs').execute() as unknown as LogRow[])
      .filter(row => /\b(?:devices|q{5000})\b/.test(String(row.query)) && !/^\s*create/i.test(String(row.query)))
    rows = all.filter(row => row.status === 'failed' && /^\s*insert/i.test(String(row.query)))
    if (rows.length >= failures && all.some(row => /^\s*select/i.test(String(row.query))))
      break
    await Bun.sleep(25)
  }
  assert.equal(rows.length, failures, JSON.stringify(rows))

  /** The one logged row whose SQL, unquoted and lowercased, matches `shape`. */
  function logged(from: LogRow[], shape: RegExp): LogRow {
    const matches = from.filter(row => shape.test(String(row.query).replace(/["`]/g, '').toLowerCase()))
    assert.equal(matches.length, 1, `expected one logged query like ${shape}: ${JSON.stringify(from)}`)
    return matches[0]!
  }

  /** The logged error of the failed insert of `key`. */
  function loggedError(key: keyof typeof caught): string {
    return String(logged(rows, new RegExp(`^insert into devices\\s*\\(id,\\s*${key}\\)`)).error)
  }

  // Nothing withheld from the bindings survives in any error: no 12
  // characters of the token or of the build's hex, and not the one-time code.
  // In production the benign handle is withheld too.
  const withheld = [...pieces(TOKEN, 12), ...pieces(BUILD_TOKEN.slice(5), 12), String(OTP), ...(expected === 'types' ? ['lovelace'] : [])]
  for (const row of rows) {
    for (const value of withheld)
      assert(!String(row.error).includes(value), `${appEnv} kept ${JSON.stringify(value)} in query_logs.error: ${row.error}`)
  }

  // Everything else in the message is kept: what is stored is the driver's
  // message with some of it replaced by markers, so the text around the
  // markers is the message's own, from its start to its end, in order.
  const MARKER = /<(?:redacted|string|number)>/
  for (const key of Object.keys(caught) as Array<keyof typeof caught>) {
    if (caught[key] === undefined)
      continue
    const stored = loggedError(key)
    const around = stored.split(MARKER)
    let from = 0
    for (const [index, part] of around.entries()) {
      const at = caught[key]!.indexOf(part, from)
      assert(index === 0 ? at === 0 : at >= 0, `${key}: ${JSON.stringify(stored)} is not ${JSON.stringify(caught[key])} with markers`)
      from = at + part.length
    }
    assert(caught[key]!.endsWith(around.at(-1)!), `${key}: ${JSON.stringify(stored)} does not end as ${JSON.stringify(caught[key])}`)
  }

  // Where a withheld value was printed, its marker stands in its place:
  // `<redacted>` for a secret where values are kept, its type in production.
  const marker = (type: string): string => expected === 'types' ? type : '<redacted>'
  for (const [key, type] of [['token', '<string>'], ['build', '<string>'], ['otp', '<number>']] as const) {
    if (printed(key))
      assert(loggedError(key).includes(marker(type)), `${key}: ${loggedError(key)}`)
  }

  // A value that is not withheld stays in the error wherever the driver
  // printed it: outside production, the benign handle.
  if (expected === 'values')
    assert.equal(loggedError('handle').includes(fragment.handle), printed('handle'), loggedError('handle'))

  // Only the first MAX_QUERY_LOG_ERROR_LENGTH characters of an error are kept,
  // with the values in them withheld as anywhere else: in production the
  // PostgreSQL value is a type, and it runs past the limit.
  const storedLong = String(logged(all.filter(row => row.status === 'failed'), dialect === 'postgres' ? /^select \* from devices where id = / : /^select \* from q{5000}/).error)
  const cut = /<truncated: (\d+) more characters>$/.exec(storedLong)
  if (longError.length <= MAX_QUERY_LOG_ERROR_LENGTH)
    assert.equal(storedLong, longError)
  else if (dialect === 'postgres' && expected === 'types')
    assert(cut && storedLong.startsWith(`${longError.slice(0, longError.indexOf(LONG))}<string><truncated: `) && !storedLong.includes('q'.repeat(16)), storedLong)
  else
    assert.equal(storedLong, `${longError.slice(0, MAX_QUERY_LOG_ERROR_LENGTH)}<truncated: ${longError.length - MAX_QUERY_LOG_ERROR_LENGTH} more characters>`)

  console.log('query log errors OK')
}
finally {
  resetDatabaseConnection()
}
