import { describe, expect, test } from 'bun:test'
import { MCPClient } from '../src/mcp'
import { createMCPServer, mcpTextResult } from '../src/mcp-server'

function fixture() {
  let writes = 0
  const server = createMCPServer({
    name: 'test', version: '1.0.0', pageSize: 1, maxBodyBytes: 1024,
    authenticate: request => request.headers.get('authorization') === 'Bearer allowed' ? { write: request.headers.get('x-write') === 'yes' } : new Response(null, { status: 401 }),
    tools: [
      { name: 'read', description: 'Read', inputSchema: { type: 'object', additionalProperties: false }, execute: () => mcpTextResult({ ok: true }) },
      { name: 'write', description: 'Write', available: principal => principal.write, inputSchema: { type: 'object', properties: { count: { type: 'integer', minimum: 1, maximum: 5 } }, required: ['count'], additionalProperties: false }, execute: args => { writes++; return mcpTextResult({ count: args.count }) } },
      { name: 'fail', description: 'Fail', inputSchema: { type: 'object' }, execute: () => { throw new Error('SECRET') } },
    ],
    resources: [{ uri: 'test://guide', name: 'Guide', read: () => 'Guide text' }],
    prompts: [{ name: 'review', arguments: [{ name: 'date', required: true }], get: args => ({ messages: [{ role: 'user', content: { type: 'text', text: args.date! } }] }) }],
  })
  const call = (message: unknown, headers: Record<string, string> = {}, method = 'POST') => server.handle(new Request('https://example.com/mcp', {
    method, headers: { authorization: 'Bearer allowed', 'Content-Type': 'application/json', accept: 'application/json, text/event-stream', ...headers },
    ...(method === 'POST' ? { body: JSON.stringify(message) } : {}),
  }))
  const rpc = async (method: string, params: Record<string, unknown> = {}, headers: Record<string, string> = {}) => (await call({ jsonrpc: '2.0', id: 0, method, params }, headers)).json()
  return { server, call, rpc, writes: () => writes }
}

describe('stateless Streamable HTTP MCP', () => {
  test('initializes, negotiates a supported version, pings, accepts notifications', async () => {
    const { rpc, call } = fixture()
    const init = await rpc('initialize', { protocolVersion: 'future', capabilities: {}, clientInfo: { name: 'test', version: '1' } })
    expect(init.result.protocolVersion).toBe('2025-11-25')
    expect(init.result.capabilities.tools.listChanged).toBe(false)
    expect((await rpc('ping')).result).toEqual({})
    expect((await call({ jsonrpc: '2.0', method: 'notifications/initialized' })).status).toBe(202)
    expect((await rpc('initialize')).error.code).toBe(-32602)
  })
  test('authenticates each request, validates origins, Accept and protocol version', async () => {
    const { call } = fixture()
    const message = { jsonrpc: '2.0', id: 1, method: 'ping' }
    expect((await call(message, { authorization: '' })).status).toBe(401)
    expect((await call(message, { origin: 'https://evil.test' })).status).toBe(403)
    expect((await call(message, { accept: 'application/json' })).status).toBe(406)
    expect((await call(message, { accept: 'application/json;q=0, text/event-stream' })).status).toBe(406)
    expect((await call(message, { 'mcp-protocol-version': 'wrong' })).status).toBe(400)
    expect((await call(message, {}, 'GET')).status).toBe(405)
    expect((await call(message, {}, 'DELETE')).headers.get('allow')).toBe('POST')
    expect((await call(message)).headers.get('cache-control')).toBe('no-store')
  })
  test('never trusts Origin just because an attacker-controlled Host matches it', async () => {
    const { server, call } = fixture()
    const message = { jsonrpc: '2.0', id: 1, method: 'ping' }
    expect((await call(message, { origin: 'https://example.com' })).status).toBe(403)
    const rebound = new Request('http://attacker.example/mcp', { method: 'POST', headers: { Authorization: 'Bearer allowed', Origin: 'http://attacker.example', 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }, body: JSON.stringify(message) })
    expect((await server.handle(rebound)).status).toBe(403)
    const trusted = createMCPServer({ name: 'test', version: '1', allowedOrigins: ['https://trusted.example'], authenticate: () => ({}) })
    const request = (origin: string) => new Request('http://internal-api/mcp', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }, body: JSON.stringify(message) })
    expect((await trusted.handle(request('https://trusted.example'))).status).toBe(200)
    expect((await trusted.handle(request('https://trusted.example.attacker.test'))).status).toBe(403)
    expect(() => createMCPServer({ name: 'test', version: '1', authenticate: () => ({}), allowedOrigins: ['*'] })).toThrow()
    expect(() => createMCPServer({ name: 'test', version: '1', authenticate: () => ({}), allowedOrigins: ['https://trusted.example/path'] })).toThrow()
  })
  test('rejects batches, malformed requests and missing ids without executing writes', async () => {
    const { call, writes } = fixture()
    for (const message of [[], null, {}, { jsonrpc: '2.0', id: null, method: 'ping' }, { jsonrpc: '2.0', method: 'tools/call', params: { name: 'write', arguments: { count: 1 } } }, { jsonrpc: '2.0', id: 1, method: 'tools/call', params: [] }])
      expect((await call(message, { 'x-write': 'yes' })).status).toBe(400)
    expect(writes()).toBe(0)
    expect((await call({ text: 'x'.repeat(2000) })).status).toBe(413)
  })
  test('filters discovery and execution on every call, paginates and validates input', async () => {
    const { rpc, writes } = fixture()
    const list = (await rpc('tools/list')).result
    expect(list.tools.map((tool: any) => tool.name)).toEqual(['read'])
    expect(list.tools[0].execute).toBeUndefined()
    expect((await rpc('tools/list', { cursor: list.nextCursor })).result.tools[0].name).toBe('fail')
    expect((await rpc('tools/list', { cursor: 'arbitrary' })).error.code).toBe(-32602)
    expect((await rpc('tools/call', { name: 'write', arguments: { count: 1 } })).error.code).toBe(-32602)
    for (const args of [{}, { count: '1' }, { count: 0 }, { count: 6 }, { count: 1, user_id: 9 }])
      expect((await rpc('tools/call', { name: 'write', arguments: args }, { 'x-write': 'yes' })).error.code).toBe(-32602)
    expect(writes()).toBe(0)
    expect((await rpc('tools/call', { name: 'write', arguments: { count: 1 } }, { 'x-write': 'yes' })).result.structuredContent).toEqual({ count: 1 })
    expect(writes()).toBe(1)
    expect((await rpc('tools/call', { name: 'fail' })).result.isError).toBe(true)
    expect(JSON.stringify(await rpc('tools/call', { name: 'fail' }))).not.toContain('SECRET')
  })
  test('serves resources and validated prompts, refuses unknown URIs and methods', async () => {
    const { rpc } = fixture()
    expect((await rpc('resources/read', { uri: 'test://guide' })).result.contents[0].text).toBe('Guide text')
    expect((await rpc('resources/read', { uri: 'file:///etc/passwd' })).error.code).toBe(-32002)
    expect((await rpc('prompts/get', { name: 'review' })).error.code).toBe(-32602)
    expect((await rpc('prompts/get', { name: 'review', arguments: { date: 12 } })).error.code).toBe(-32602)
    expect((await rpc('prompts/get', { name: 'review', arguments: { date: '2026-10-16' } })).result.messages[0].content.text).toBe('2026-10-16')
    expect((await rpc('unknown')).error.code).toBe(-32601)
  })
  test('refuses unsupported schemas and duplicate tool names at registration', () => {
    const base = { name: 'test', version: '1', authenticate: () => ({}) }
    const tool = { name: 'tool', description: 'Tool', inputSchema: { type: 'object' }, execute: () => mcpTextResult({}) }
    expect(() => createMCPServer({ ...base, tools: [tool, tool] })).toThrow('duplicate')
    expect(() => createMCPServer({ ...base, tools: [{ ...tool, inputSchema: { type: 'object', oneOf: [] } }] })).toThrow('Unsupported')
  })
  test('Stacks HTTP client connects and invokes the native server over a real socket', async () => {
    const { server } = fixture()
    const http = Bun.serve({ port: 0, fetch: server.handle })
    const client = new MCPClient({ name: 'native', transport: { type: 'streamable-http', url: `http://localhost:${http.port}/mcp`, headers: { Authorization: 'Bearer allowed' } } })
    try {
      await client.connect()
      expect(client.listTools().map(tool => tool.name)).toEqual(['read', 'fail'])
      expect((await client.callTool('read')).content[0]?.text).toBe('{"ok":true}')
      expect((await client.readResource('test://guide')).text).toBe('Guide text')
    }
    finally { await client.disconnect(); await http.stop(true) }
  })
})
