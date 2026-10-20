/**
 * Runs the generated `requests` routes (orm/src/routes.ts) against one
 * database: store, PUT, PATCH, soft destroy and soft bulk-delete. The handlers
 * are taken from route registration and called directly, so route middleware
 * does not run. See ../auto-crud-timestamps.test.ts.
 *
 * STACKS_AUTO_CRUD_TIMESTAMPS_DIALECT names the dialect the writes must reach.
 * With STACKS_AUTO_CRUD_TIMESTAMPS_QB_URL set, the query builder is pointed at
 * that MySQL database after the routes load while DB_CONNECTION keeps naming
 * SQLite, so the writes have to follow the live connection, not the variable.
 */
import assert from 'node:assert/strict'
import { join } from 'node:path'
import process from 'node:process'

const dialect = process.env.STACKS_AUTO_CRUD_TIMESTAMPS_DIALECT as 'sqlite' | 'postgres' | 'mysql'
assert(dialect === 'sqlite' || dialect === 'postgres' || dialect === 'mysql')

const { route } = await import('@stacksjs/router')
const handlers = new Map<string, (request: Request) => Promise<Response>>()
for (const verb of ['post', 'put', 'patch', 'delete'] as const) {
  const register = (route as any)[verb].bind(route)
  ;(route as any)[verb] = (path: string, handler: (request: Request) => Promise<Response>) => {
    handlers.set(`${verb.toUpperCase()} ${path}`, handler)
    return register(path, handler)
  }
}
await import('../../src/routes')

const { buildMigrationPlan, config, createQueryBuilder, generateSql, loadModels, setConfig } = await import('@stacksjs/query-builder')
if (process.env.STACKS_AUTO_CRUD_TIMESTAMPS_QB_URL)
  setConfig({ ...config, dialect: 'mysql', database: { ...config.database, url: process.env.STACKS_AUTO_CRUD_TIMESTAMPS_QB_URL } })
assert.equal(config.dialect, dialect, 'the routes are configured for the dialect under test')
const db = createQueryBuilder() as any
const plan = buildMigrationPlan(await loadModels({ modelsDir: join(import.meta.dir, '../../../../defaults/app/Models') }), { dialect })
plan.tables = plan.tables.filter((table: { table: string }) => table.table === 'requests')
for (const table of plan.tables) {
  for (const column of table.columns)
    delete column.references
}
for (const statement of generateSql(plan))
  await db.unsafe(statement)

const quoted = dialect === 'mysql' ? '`requests`' : '"requests"'
const text = dialect === 'mysql' ? 'CHAR' : 'TEXT'
async function stored(id: unknown): Promise<Record<string, string | null>> {
  const rows = await db.unsafe(`SELECT CAST(created_at AS ${text}) AS created_at, CAST(updated_at AS ${text}) AS updated_at, CAST(deleted_at AS ${text}) AS deleted_at FROM ${quoted} WHERE id = ${Number(id)}`)
  return rows[0]
}
async function call(key: string, method: string, path: string, body?: unknown, id?: unknown): Promise<Response> {
  const handler = handlers.get(key)
  assert(handler, `${key} is registered`)
  const request = new Request(`http://localhost${path}`, { method, body: body === undefined ? undefined : JSON.stringify(body), headers: { 'content-type': 'application/json' } })
  return handler(Object.assign(request, { params: id === undefined ? {} : { id: String(id) } }))
}

// The instant each stored value names, read the way each dialect stores it:
// MySQL DATETIME and Postgres `timestamp` hold the UTC wall clock with no
// zone, SQLite holds the string the route wrote.
function instant(value: string | null): number {
  assert(value, 'a timestamp was stored')
  return dialect === 'sqlite' ? Date.parse(value) : Date.parse(`${value.replace(' ', 'T')}Z`)
}
function assertWritten(value: string | null, before: number): void {
  assert(value, 'a timestamp was stored')
  if (dialect === 'sqlite')
    assert.match(value, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/, 'SQLite keeps the ISO string the route always wrote')
  const at = instant(value)
  // MySQL DATETIME keeps whole seconds and rounds, so allow a second either side.
  assert(at >= before - 1000 && at <= Date.now() + 1000, `${value} is the current UTC time, not a local wall clock`)
}

const row = { method: 'GET', path: '/probe', status_code: 200, duration_ms: 3, ip_address: '127.0.0.1', memory_usage: 1 }
const ids: unknown[] = []
for (let i = 0; i < 2; i++) {
  const before = Date.now()
  const response = await call('POST /api/requests', 'POST', '/api/requests', row)
  assert.equal(response.status, 201, await response.clone().text())
  const created = (await response.json()).data
  const [{ id }] = await db.unsafe(`SELECT MAX(id) AS id FROM ${quoted}`)
  ids.push(id)
  const values = await stored(id)
  assertWritten(values.created_at, before)
  assert.equal(values.updated_at, values.created_at)
  if (dialect === 'sqlite')
    assert.equal(created.created_at, values.created_at, 'the response carries the stored string unchanged')
  else
    assert.equal(Date.parse(created.created_at), instant(values.created_at), 'the response names the stored instant')
}

// Backdated first, so a stamp that never happened cannot pass for one.
const stale = dialect === 'sqlite' ? '2000-01-01T00:00:00.000Z' : '2000-01-01 00:00:00'
for (const [method, status] of [['PUT', 404], ['PATCH', 410]] as const) {
  await db.unsafe(`UPDATE ${quoted} SET updated_at = '${stale}' WHERE id = ${Number(ids[0])}`)
  const before = Date.now()
  const response = await call(`${method} /api/requests/{id}`, method, `/api/requests/${ids[0]}`, { status_code: status }, ids[0])
  assert.equal(response.status, 200, await response.clone().text())
  const updated = (await response.json()).data
  const values = await stored(ids[0])
  assertWritten(values.updated_at, before)
  if (dialect === 'sqlite')
    assert.equal(updated.updated_at, values.updated_at, 'the response carries the stored string unchanged')
  else
    assert.equal(Date.parse(updated.updated_at), instant(values.updated_at), 'the response names the stored instant')
}

let before = Date.now()
let response = await call('DELETE /api/requests/{id}', 'DELETE', `/api/requests/${ids[0]}`, undefined, ids[0])
assert.equal(response.status, 204, await response.clone().text())
const destroyed = await stored(ids[0])
assertWritten(destroyed.deleted_at, before)
assert.equal(destroyed.updated_at, destroyed.deleted_at)

before = Date.now()
response = await call('POST /api/requests/bulk-delete', 'POST', '/api/requests/bulk-delete', { ids: [ids[1]] })
assert.equal(response.status, 200, await response.clone().text())
const bulk = await stored(ids[1])
assertWritten(bulk.deleted_at, before)
assert.equal(bulk.updated_at, bulk.deleted_at)

console.log(`auto-crud timestamps OK ${dialect}`)
process.exit(0)
