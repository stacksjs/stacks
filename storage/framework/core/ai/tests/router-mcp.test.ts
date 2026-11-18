import { describe, expect, test } from 'bun:test'
import { createStacksRouter } from '@stacksjs/router/runtime'
import { schema } from '@stacksjs/validation'
import { mcpTextResult } from '../src/mcp-server'
import { createRouterMCPServer, mountRouterMCPServer } from '../src/router-mcp'

function call(server: ReturnType<typeof createRouterMCPServer>, method: string, params = {}, headers: HeadersInit = {}) {
  return server.handle(new Request('https://example.test/mcp', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...headers },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  }))
}

describe('router-generated MCP server', () => {
  test('discovers late registered routes and dispatches path, query and JSON through the router', async () => {
    const router = createStacksRouter({ autoDiscoverRoutes: false, csrf: false })
    mountRouterMCPServer({ router, path: '/api/mcp', name: 'application', version: '1', authenticate: () => ({}) })
    router.post('/api/posts/{id}', async request => ({ id: request.params.id, query: new URL(request.url).searchParams.getAll('tag'), body: await request.json(), authorization: request.headers.get('authorization'), cookie: request.headers.get('cookie') }))
    router.get('/website', () => 'page')
    const other = createStacksRouter({ autoDiscoverRoutes: false, csrf: false })
    other.get('/api/other', () => ({}))
    const server = await router.serve({ port: 0, hostname: '127.0.0.1' })
    const rpc = async (method: string, params = {}) => (await fetch(`http://127.0.0.1:${server.port}/api/mcp`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', Authorization: 'Bearer caller', Cookie: 'session=ambient' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    })).json()
    try {
      const tools = (await rpc('tools/list')).result.tools
      expect(tools).toHaveLength(1)
      expect(tools[0].description).toContain('POST /api/posts/{id}')
      expect(tools[0].inputSchema.properties.path.required).toEqual(['id'])
      const result = await rpc('tools/call', { name: tools[0].name, arguments: { path: { id: 'café' }, query: { tag: ['one', 'two'] }, body: { title: 'Hello' } } })
      expect(result.result.structuredContent).toEqual({ status: 200, body: { id: 'café', query: ['one', 'two'], body: { title: 'Hello' }, authorization: 'Bearer caller', cookie: null } })
      expect((await rpc('tools/call', { name: tools[0].name, arguments: {} })).error.code).toBe(-32602)
    }
    finally { await server.stop(true) }
  })

  test('customizes selection, tool contracts, availability, credentials, and additional tools', async () => {
    const router = createStacksRouter({ autoDiscoverRoutes: false, csrf: false })
    router.post('/v1/posts', async request => ({ body: await request.json(), credential: request.headers.get('authorization'), origin: new URL(request.url).origin }))
    router.get('/v1/private', () => ({}))
    router.get('/v10/outside', () => ({}))
    router.get('/v1/omitted', () => ({}))
    let writes = 0
    const server = createRouterMCPServer({
      router, name: 'custom', version: '1', prefix: '/v1', origin: 'https://api.example.test',
      authenticate: request => ({ write: request.headers.get('x-write') === 'yes', token: 'scoped-key' }),
      filter: endpoint => endpoint.path !== '/v1/private',
      configureTool: (endpoint, tool) => endpoint.path === '/v1/omitted' ? false : {
        ...tool, name: 'create_post', description: 'Create a post', available: principal => principal.write,
        inputSchema: { type: 'object', properties: { body: { type: 'object', properties: { title: { type: 'string' } }, required: ['title'], additionalProperties: false } }, required: ['body'], additionalProperties: false },
      },
      requestHeaders: ({ principal }) => ({ Authorization: `Bearer ${principal.token}` }),
      tools: [{ name: 'custom', description: 'App-owned operation', inputSchema: { type: 'object' }, execute: () => { writes++; return mcpTextResult({ ok: true }) } }],
    })
    expect((await (await call(server, 'tools/list')).json()).result.tools.map((tool: any) => tool.name)).toEqual(['custom'])
    expect((await (await call(server, 'tools/call', { name: 'create_post', arguments: { body: { title: 'Hello' } } })).json()).error.code).toBe(-32602)
    const tools = (await (await call(server, 'tools/list', {}, { 'x-write': 'yes' })).json()).result.tools
    expect(tools.map((tool: any) => tool.name)).toEqual(['create_post', 'custom'])
    expect((await (await call(server, 'tools/call', { name: 'create_post', arguments: { body: {} } }, { 'x-write': 'yes' })).json()).error.code).toBe(-32602)
    const result = await (await call(server, 'tools/call', { name: 'create_post', arguments: { body: { title: 'Hello' } } }, { 'x-write': 'yes' })).json()
    expect(result.result.structuredContent.body).toEqual({ body: { title: 'Hello' }, credential: 'Bearer scoped-key', origin: 'https://api.example.test' })
    await call(server, 'tools/call', { name: 'custom' })
    expect(writes).toBe(1)
  })

  test('keeps action authorization, validation, route rate limits and MCP authentication', async () => {
    const router = createStacksRouter({ autoDiscoverRoutes: false, csrf: false })
    let writes = 0
    router.post('/api/guarded', { authorize: () => false, handle: () => { writes++; return {} } })
    router.post('/api/validated', { validations: { title: { rule: schema.string().required() } }, handle: () => { writes++; return {} } })
    router.get('/api/limited', () => ({ ok: true })).rateLimit(1, 'minute')
    const server = createRouterMCPServer({ router, name: 'guarded', version: '1', authenticate: request => request.headers.get('authorization') === 'Bearer allowed' ? {} : new Response(null, { status: 401 }) })
    expect((await call(server, 'tools/list')).status).toBe(401)
    const headers = { Authorization: 'Bearer allowed' }
    const tools = (await (await call(server, 'tools/list', {}, headers)).json()).result.tools
    const guarded = tools.find((tool: any) => tool.description === 'POST /api/guarded').name
    const limited = tools.find((tool: any) => tool.description === 'GET /api/limited').name
    const denial = await (await call(server, 'tools/call', { name: guarded }, headers)).json()
    expect(denial.result.isError).toBe(true)
    expect(denial.result.structuredContent.status).toBe(403)
    expect(writes).toBe(0)
    const validated = tools.find((tool: any) => tool.description === 'POST /api/validated').name
    const invalid = await (await call(server, 'tools/call', { name: validated, arguments: { body: {} } }, headers)).json()
    expect(invalid.result.isError).toBe(true)
    expect(invalid.result.structuredContent.status).toBe(422)
    expect(writes).toBe(0)
    expect((await (await call(server, 'tools/call', { name: limited }, headers)).json()).result.structuredContent.status).toBe(200)
    expect((await (await call(server, 'tools/call', { name: limited }, headers)).json()).result.structuredContent.status).toBe(429)
  })

  test('bounds responses, redacts server failures, and preserves API errors and empty results', async () => {
    const router = createStacksRouter({ autoDiscoverRoutes: false, csrf: false })
    router.get('/api/large', () => new Response('x'.repeat(256)))
    router.get('/api/error', () => new Response('internal secret', { status: 500 }))
    router.get('/api/missing', () => Response.json({ message: 'Missing' }, { status: 404 }))
    router.delete('/api/empty', () => new Response(null, { status: 204 }))
    const server = createRouterMCPServer({ router, name: 'errors', version: '1', maxResponseBytes: 128, authenticate: () => ({}) })
    const tools = (await (await call(server, 'tools/list')).json()).result.tools
    const invoke = async (path: string) => (await (await call(server, 'tools/call', { name: tools.find((tool: any) => tool.description.endsWith(path)).name })).json()).result
    expect((await invoke('/api/large')).isError).toBe(true)
    const failure = await invoke('/api/error')
    expect(failure.isError).toBe(true)
    expect(JSON.stringify(failure)).not.toContain('secret')
    expect((await invoke('/api/missing')).structuredContent).toMatchObject({ status: 404, body: { message: 'Missing' } })
    expect((await invoke('/api/empty')).structuredContent).toEqual({ status: 204, body: null })
  })

  test('mounts within groups, skips its own endpoint and distinguishes colliding route labels', async () => {
    const router = createStacksRouter({ autoDiscoverRoutes: false, csrf: false })
    router.group({ prefix: '/api' }, () => {
      mountRouterMCPServer({ router, name: 'grouped', version: '1', authenticate: () => ({}) })
      router.get('/a/b', () => ({}))
      router.get('/a_b', () => ({}))
    })
    const response = await router.handleRequest(new Request('http://localhost/api/mcp', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    }))
    const tools = (await response.json()).result.tools
    expect(tools).toHaveLength(2)
    expect(new Set(tools.map((tool: any) => tool.name)).size).toBe(2)
    expect((await router.handleRequest(new Request('http://localhost/api/mcp'))).status).toBe(405)
  })

  test('snapshots configuration and rejects malformed options before accepting requests', async () => {
    const router = createStacksRouter({ autoDiscoverRoutes: false, csrf: false })
    router.get('/api/read', () => ({ ok: true }))
    const origins = ['https://trusted.test']
    const server = createRouterMCPServer({ router, name: 'snapshot', version: '1', allowedOrigins: origins, authenticate: () => ({}) })
    origins.push('https://attacker.test')
    expect((await call(server, 'tools/list', {}, { Origin: 'https://attacker.test' })).status).toBe(403)
    expect((await call(server, 'tools/list', {}, { Origin: 'https://trusted.test' })).status).toBe(200)
    const options = { router, name: 'invalid', version: '1', authenticate: () => ({}) }
    expect(() => createRouterMCPServer({ ...options, prefix: 'api' })).toThrow()
    expect(() => createRouterMCPServer({ ...options, origin: 'https://example.test/path' })).toThrow()
    expect(() => createRouterMCPServer({ ...options, maxResponseBytes: 0 })).toThrow()
  })

  test('refuses path traversal, unsupported route shapes and recursive manual mounts', async () => {
    const router = createStacksRouter({ autoDiscoverRoutes: false, csrf: false })
    let reads = 0
    router.get('/api/items/{id}', request => { reads++; return { id: request.params.id } })
    router.get('/api/../outside', () => ({}))
    router.get('/api/wild/*', () => ({}))
    const server = createRouterMCPServer({ router, name: 'paths', version: '1', authenticate: () => ({}) })
    router.post('/api/manual-mcp', server.handle).parseBody(false)
    const invoke = async (method: string, params = {}) => (await router.handleRequest(new Request('http://localhost/api/manual-mcp', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    }))).json()
    const tools = (await invoke('tools/list')).result.tools
    expect(tools).toHaveLength(1)
    for (const id of ['.', '..']) {
      expect((await invoke('tools/call', { name: tools[0].name, arguments: { path: { id } } })).result.isError).toBe(true)
    }
    expect(reads).toBe(0)
    const result = await invoke('tools/call', { name: tools[0].name, arguments: { path: { id: 'a/b' } } })
    expect(result.result.structuredContent.body.id).toBe('a/b')
    expect(reads).toBe(1)
  })

  test('cancels streaming responses and interrupts an unfinished API body when the caller aborts', async () => {
    const router = createStacksRouter({ autoDiscoverRoutes: false, csrf: false })
    let cancelled = 0
    const reading = Promise.withResolvers<void>()
    const stream = () => new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(new TextEncoder().encode('{')); reading.resolve() },
      cancel() { cancelled++ },
    })
    router.get('/api/events', () => new Response(stream(), { headers: { 'Content-Type': 'text/event-stream' } }))
    router.get('/api/unfinished', () => new Response(stream(), { headers: { 'Content-Type': 'application/json' } }))
    const server = createRouterMCPServer({ router, name: 'cancellation', version: '1', authenticate: () => ({}) })
    const tools = (await (await call(server, 'tools/list')).json()).result.tools
    const name = (path: string) => tools.find((tool: any) => tool.description.endsWith(path)).name
    const controller = new AbortController()
    const pending = server.handle(new Request('https://example.test/mcp', {
      method: 'POST', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: name('/api/unfinished') } }),
    }))
    await reading.promise
    controller.abort()
    expect((await (await pending).json()).result.isError).toBe(true)
    expect(cancelled).toBe(1)
    expect((await (await call(server, 'tools/call', { name: name('/api/events') })).json()).result.isError).toBe(true)
    expect(cancelled).toBe(2)
  })
})
