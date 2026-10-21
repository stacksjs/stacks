/**
 * Runs the generated store route (orm/src/routes.ts) for a `useUuid` model,
 * `tags`, and for one without the trait, `requests`, against the database
 * DB_CONNECTION names. The handlers are taken from route registration and
 * called directly, so route middleware does not run. See
 * ../auto-crud-uuid.test.ts.
 */
import assert from 'node:assert/strict'
import { join } from 'node:path'
import process from 'node:process'

const dialect = process.env.DB_CONNECTION as 'sqlite' | 'postgres'
assert(dialect === 'sqlite' || dialect === 'postgres')

const { route } = await import('@stacksjs/router')
const handlers = new Map<string, (request: Request) => Promise<Response>>()
const register = (route as any).post.bind(route)
;(route as any).post = (path: string, handler: (request: Request) => Promise<Response>) => {
  handlers.set(path, handler)
  return register(path, handler)
}
await import('../../src/routes')

const { buildMigrationPlan, config, createQueryBuilder, generateSql, loadModels } = await import('@stacksjs/query-builder')
assert.equal(config.dialect, dialect, 'the routes are configured for the dialect under test')
const db = createQueryBuilder() as any
const plan = buildMigrationPlan(await loadModels({ modelsDir: join(import.meta.dir, '../../../../defaults/app/Models') }), { dialect })
plan.tables = plan.tables.filter((table: { table: string }) => ['tags', 'requests'].includes(table.table))
for (const table of plan.tables) {
  for (const column of table.columns)
    delete column.references
}
for (const statement of generateSql(plan))
  await db.unsafe(statement)

async function store(path: string, body: unknown): Promise<Record<string, unknown>> {
  const handler = handlers.get(path)
  assert(handler, `POST ${path} is registered`)
  const request = new Request(`http://localhost${path}`, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } })
  const response = await handler(Object.assign(request, { params: {} }))
  assert.equal(response.status, 201, await response.clone().text())
  return (await response.json()).data
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const red = await store('/api/tags', { name: 'Red', slug: 'red' })
const blue = await store('/api/tags', { name: 'Blue', slug: 'blue' })
const rows = await db.unsafe('SELECT slug, CAST(uuid AS TEXT) AS uuid FROM tags ORDER BY slug')
const stored = Object.fromEntries(rows.map((row: { slug: string, uuid: string | null }) => [row.slug, row.uuid]))
assert.match(String(stored.red), UUID, 'a row created through the API gets a uuid')
assert.match(String(stored.blue), UUID)
assert.notEqual(stored.red, stored.blue, 'each row gets its own')
assert.equal(red.uuid, stored.red, 'the response names the stored uuid')
assert.equal(blue.uuid, stored.blue)

// A model without the trait has no uuid column to write.
await store('/api/requests', { method: 'GET', path: '/probe', status_code: 200, duration_ms: 3, ip_address: '127.0.0.1', memory_usage: 1 })

console.log(`auto-crud uuid OK ${dialect}`)
process.exit(0)
