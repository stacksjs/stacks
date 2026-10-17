import { expect, test } from 'bun:test'
import { createMCPServer, mcpTextResult } from '../src/mcp-server'

const call = (server: ReturnType<typeof createMCPServer>, method: string, params: Record<string, unknown> = {}) => server.handle(new Request('https://example.com/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) }))

test('registered MCP validation and origin policies cannot be mutated through the supplied definitions', async () => {
  const schema = { type: 'object', properties: { confirm: { type: 'boolean', const: true } }, required: ['confirm'], additionalProperties: false }
  const origins = ['https://trusted.test']
  let writes = 0
  const tool = { name: 'write', description: 'Write', inputSchema: schema, execute: () => { writes++; return mcpTextResult({ ok: true }) } }
  const server = createMCPServer({ name: 'test', version: '1', authenticate: () => ({}), allowedOrigins: origins, tools: [tool] })
  schema.properties.confirm.const = false
  schema.required.length = 0
  tool.execute = () => mcpTextResult({ wrong: true })
  origins.push('https://attacker.test')
  expect((await (await call(server, 'tools/call', { name: 'write', arguments: { confirm: false } })).json()).error.code).toBe(-32602)
  expect(writes).toBe(0)
  expect((await (await call(server, 'tools/call', { name: 'write', arguments: { confirm: true } })).json()).result.structuredContent).toEqual({ ok: true })
  expect(writes).toBe(1)
  expect((await server.handle(new Request('https://example.com/mcp', { headers: { Origin: 'https://attacker.test' } }))).status).toBe(403)
})

test('OAuth authentication challenges point clients to protected resource discovery', async () => {
  for (const challenge of ['Bearer realm="HQ"', 'Bearer', null]) {
    const server = createMCPServer({ name: 'test', version: '1', resourceMetadataUrl: 'https://example.com/.well-known/oauth-protected-resource/mcp', authenticate: () => new Response(null, { status: 401, headers: challenge ? { 'WWW-Authenticate': challenge } : {} }) })
    const response = await call(server, 'initialize')
    expect(response.status).toBe(401)
    expect(response.headers.get('www-authenticate')).not.toStartWith('Bearer,')
    expect(response.headers.get('www-authenticate')).toContain('resource_metadata="https://example.com/.well-known/oauth-protected-resource/mcp"')
  }
})

test('broken diagnostics do not leak errors or reject the HTTP handler', async () => {
  const server = createMCPServer({ name: 'test', version: '1', authenticate: () => ({}), onError: () => { throw new Error('diagnostic secret') }, tools: [{ name: 'fail', description: 'Fail', inputSchema: { type: 'object' }, execute: () => { throw new Error('secret') } }] })
  const response = await call(server, 'tools/call', { name: 'fail' })
  const result = await response.json()
  expect(result.result.isError).toBe(true)
  expect(JSON.stringify(result)).not.toContain('secret')
})

test('malformed schema constraints fail registration and Unicode lengths count code points', async () => {
  const register = (properties: Record<string, unknown>) => createMCPServer({ name: 'test', version: '1', authenticate: () => ({}), tools: [{ name: 'read', description: 'Read', inputSchema: { type: 'object', properties }, execute: args => mcpTextResult(args) }] })
  for (const schema of [{ type: 'wat' }, { enum: 'yes' }, { maxLength: -1 }, { minimum: 3, maximum: 2 }, { required: 'name' }, { properties: [] }, { const: {} }]) expect(() => register({ value: schema })).toThrow()
  const server = register({ value: { type: 'string', minLength: 1, maxLength: 1 } })
  expect((await (await call(server, 'tools/call', { name: 'read', arguments: { value: '🦉' } })).json()).result.isError).not.toBe(true)
})
