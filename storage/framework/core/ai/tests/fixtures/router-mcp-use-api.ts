import assert from 'node:assert/strict'
import { join } from 'node:path'
import process from 'node:process'
import { route } from '@stacksjs/router/runtime'
import { mountRouterMCPServer } from '../../src/router-mcp'

// Mount before the trait generator, just as a user's routes/api.ts would.
mountRouterMCPServer({ name: 'trait-api', version: '1', authenticate: request => request.headers.get('authorization') === 'Bearer integration' ? {} : new Response(null, { status: 401 }) })
// A user's route must keep winning over the generated show route.
route.get('/api/v1/notes/{note}', request => ({ override: request.params.note }))
await import('../../../orm/src/routes')

const { buildMigrationPlan, createQueryBuilder, generateSql, loadModels } = await import('@stacksjs/query-builder')
const db = createQueryBuilder()
const plan = buildMigrationPlan(await loadModels({ modelsDir: join(process.cwd(), 'app/Models') }), { dialect: 'sqlite' })
for (const statement of generateSql(plan)) await db.unsafe(statement)

const http = Bun.serve({ port: 0, hostname: '127.0.0.1', fetch: request => route.handleRequest(request) })
try {
  const rpc = async (method: string, params = {}) => (await fetch(`http://127.0.0.1:${http.port}/mcp`, {
    method: 'POST', headers: { Authorization: 'Bearer integration', 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })).json()
  const tools = (await rpc('tools/list')).result.tools as Array<{ name: string, description: string }>
  const descriptions = tools.map(tool => tool.description).sort()
  assert.deepEqual(descriptions, ['DELETE /api/v1/notes/{id}', 'GET /api/v1/notes', 'GET /api/v1/notes/{note}', 'PATCH /api/v1/notes/{id}', 'POST /api/v1/notes', 'POST /api/v1/notes/bulk-delete', 'PUT /api/v1/notes/{id}'].sort())
  const invoke = async (description: string, args = {}) => {
    const tool = tools.find(tool => tool.description === description)
    assert(tool, description)
    return (await rpc('tools/call', { name: tool.name, arguments: args })).result
  }
  const created = await invoke('POST /api/v1/notes', { body: { title: 'First', secret: 'private' } })
  assert.equal(created.structuredContent.status, 201, JSON.stringify(created))
  const id = created.structuredContent.body.data.id
  assert.equal(created.structuredContent.body.data.title, 'First')
  assert.equal(created.structuredContent.body.data.secret, undefined)
  assert.equal((await invoke('GET /api/v1/notes/{note}', { path: { note: id } })).structuredContent.body.override, String(id))
  const updated = await invoke('PATCH /api/v1/notes/{id}', { path: { id }, body: { title: 'Updated' } })
  assert.equal(updated.structuredContent.status, 200, JSON.stringify(updated))
  assert.equal(updated.structuredContent.body.data.title, 'Updated')
  const listed = await invoke('GET /api/v1/notes', { query: { per_page: 1 } })
  assert.equal(listed.structuredContent.body.data[0].title, 'Updated')
  const removed = await invoke('DELETE /api/v1/notes/{id}', { path: { id } })
  assert.equal(removed.structuredContent.status, 204, JSON.stringify(removed))
  assert.equal(removed.structuredContent.body, null)
  assert.deepEqual((await invoke('GET /api/v1/notes')).structuredContent.body.data, [])
  console.log('router MCP useApi CRUD OK')
}
finally { await http.stop(true) }
