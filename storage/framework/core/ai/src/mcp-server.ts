import { readJsonBody, RequestBodyError } from '@stacksjs/router/body'
import { validateSchema } from './schema'

export const MCP_PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26'] as const

type JsonObject = Record<string, unknown>
type MaybePromise<T> = T | Promise<T>
export interface MCPServerContext<Principal> {
  principal: Principal
  request: Request
  signal: AbortSignal
}
export interface MCPServerTool<Principal> {
  name: string
  title?: string
  description: string
  inputSchema: JsonObject
  outputSchema?: JsonObject
  annotations?: { readOnlyHint?: boolean, destructiveHint?: boolean, idempotentHint?: boolean, openWorldHint?: boolean }
  available?: (principal: Principal) => boolean
  execute: (args: JsonObject, context: MCPServerContext<Principal>) => MaybePromise<MCPServerToolResult>
}
export interface MCPServerToolResult {
  content: Array<{ type: 'text', text: string }>
  structuredContent?: JsonObject
  isError?: boolean
}
export interface MCPServerResource<Principal> {
  uri: string
  name: string
  description?: string
  mimeType?: string
  available?: (principal: Principal) => boolean
  read: (context: MCPServerContext<Principal>) => MaybePromise<string>
}
export interface MCPServerPrompt<Principal> {
  name: string
  description?: string
  arguments?: Array<{ name: string, description?: string, required?: boolean }>
  available?: (principal: Principal) => boolean
  get: (args: Record<string, string>, context: MCPServerContext<Principal>) => MaybePromise<{
    description?: string
    messages: Array<{ role: 'user' | 'assistant', content: { type: 'text', text: string } }>
  }>
}
export interface MCPServerOptions<Principal> {
  name: string
  version: string
  instructions?: string
  /** Authenticate every HTTP request. Return the application's 401/403 response on failure. */
  authenticate: (request: Request) => MaybePromise<Principal | Response>
  /** Application response metadata, such as the authenticated principal's quota. */
  responseHeaders?: (principal: Principal) => HeadersInit
  /** Exact browser origins. With no allowlist, requests carrying Origin are refused. */
  allowedOrigins?: readonly string[]
  maxBodyBytes?: number
  pageSize?: number
  tools?: readonly MCPServerTool<Principal>[]
  resources?: readonly MCPServerResource<Principal>[]
  prompts?: readonly MCPServerPrompt<Principal>[]
  /** Server-side diagnostics only. Exceptions never become public messages. */
  onError?: (error: unknown, context: MCPServerContext<Principal>) => void
}

class ProtocolError extends Error {
  constructor(readonly code: number, message: string) { super(message) }
}
const invalid = (message: string): never => { throw new ProtocolError(-32602, message) }
function record(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
function json(body: unknown, status = 200, headers?: HeadersInit): Response {
  const response = Response.json(body, { status, headers })
  response.headers.set('Cache-Control', 'no-store')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  return response
}
function failure(id: string | number | null, code: number, message: string, status = 200): Response {
  return json({ jsonrpc: '2.0', id, error: { code, message } }, status)
}
function accepts(header: string | null, type: string): boolean {
  return (header ?? '').split(',').some((part) => {
    const [media, ...params] = part.trim().toLowerCase().split(';')
    const quality = params.find(param => param.trim().startsWith('q='))?.trim().slice(2)
    return media?.trim() === type && (quality === undefined || (Number(quality) > 0 && Number(quality) <= 1))
  })
}

/** Validate our supported schema vocabulary at registration, never silently ignore keywords. */
function checkSchema(schema: JsonObject): void {
  const supported = new Set(['$schema', 'type', 'description', 'title', 'default', 'examples', 'enum', 'const', 'properties', 'required', 'additionalProperties', 'items', 'minimum', 'maximum', 'minLength', 'maxLength', 'minItems', 'maxItems', 'pattern'])
  for (const key of Object.keys(schema)) {
    if (!supported.has(key)) throw new TypeError(`Unsupported MCP schema keyword: ${key}; use an execute validator for domain rules`)
  }
  if (schema.additionalProperties !== undefined && typeof schema.additionalProperties !== 'boolean')
    throw new TypeError('MCP additionalProperties must be a boolean')
  if (schema.pattern !== undefined) new RegExp(String(schema.pattern))
  if (record(schema.properties)) {
    for (const child of Object.values(schema.properties)) {
      if (!record(child)) throw new TypeError('MCP property schemas must be objects')
      checkSchema(child)
    }
  }
  if (schema.items !== undefined) {
    if (!record(schema.items)) throw new TypeError('MCP items must be an object schema')
    checkSchema(schema.items)
  }
}

/**
 * Stateless Streamable HTTP MCP endpoint. JSON replies; GET/DELETE return 405.
 * No session ids, SSE subscriptions, server requests or cross-request state.
 * Mount with Stacks route.post(path, server.handle).skipCsrf() and mount GET/DELETE
 * to the same handler. Bearer authentication is required on every invocation.
 */
export function createMCPServer<Principal>(options: MCPServerOptions<Principal>): { handle: (request: Request) => Promise<Response> } {
  const tools = [...(options.tools ?? [])]
  const resources = [...(options.resources ?? [])]
  const prompts = [...(options.prompts ?? [])]
  const pageSize = options.pageSize ?? 50
  const maxBodyBytes = options.maxBodyBytes ?? 1_048_576
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 1000)
    throw new RangeError('MCP pageSize must be between 1 and 1000')
  if (!Number.isSafeInteger(maxBodyBytes) || maxBodyBytes < 1)
    throw new RangeError('MCP maxBodyBytes must be positive')
  for (const list of [tools, prompts]) {
    const names = new Set<string>()
    for (const item of list) {
      if (!/^[\w.-]{1,128}$/.test(item.name) || names.has(item.name)) throw new TypeError(`Invalid or duplicate MCP name: ${item.name}`)
      names.add(item.name)
    }
  }
  for (const origin of options.allowedOrigins ?? []) {
    if (origin === 'null' || new URL(origin).origin !== origin || !/^https?:/.test(origin))
      throw new TypeError('MCP allowedOrigins must contain exact HTTP(S) origins')
  }
  if (new Set(resources.map(item => item.uri)).size !== resources.length) throw new TypeError('Duplicate MCP resource URI')
  for (const tool of tools) {
    if (tool.inputSchema.type !== 'object') throw new TypeError('MCP tool inputSchema must be an object schema')
    checkSchema(tool.inputSchema)
    if (tool.outputSchema) {
      if (tool.outputSchema.type !== 'object') throw new TypeError('MCP tool outputSchema must be an object schema')
      checkSchema(tool.outputSchema)
    }
  }

  function page<T>(items: T[], params: JsonObject, kind: string): JsonObject {
    let offset = 0
    if (params.cursor !== undefined) {
      if (typeof params.cursor !== 'string') invalid('Invalid pagination cursor')
      const decoded = Buffer.from(params.cursor as string, 'base64url').toString()
      const match = decoded.match(new RegExp(`^${kind}:(\\d+)$`))
      if (!match) invalid('Invalid pagination cursor')
      offset = Number(match![1])
      if (!Number.isSafeInteger(offset) || offset < 1 || offset >= items.length || offset % pageSize !== 0) invalid('Invalid pagination cursor')
    }
    const next = offset + pageSize
    return { [kind]: items.slice(offset, next), ...(next < items.length ? { nextCursor: Buffer.from(`${kind}:${next}`).toString('base64url') } : {}) }
  }

  async function dispatch(method: string, params: JsonObject, context: MCPServerContext<Principal>): Promise<unknown> {
    const visible = <T extends { available?: (principal: Principal) => boolean }>(items: T[]) => items.filter(item => !item.available || item.available(context.principal))
    if (method === 'initialize') {
      if (typeof params.protocolVersion !== 'string' || !record(params.capabilities) || !record(params.clientInfo) || typeof params.clientInfo.name !== 'string' || typeof params.clientInfo.version !== 'string') invalid('Invalid initialization parameters')
      return {
        protocolVersion: (MCP_PROTOCOL_VERSIONS as readonly string[]).includes(params.protocolVersion as string) ? params.protocolVersion : MCP_PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false }, resources: { subscribe: false, listChanged: false }, prompts: { listChanged: false } },
        serverInfo: { name: options.name, version: options.version },
        ...(options.instructions ? { instructions: options.instructions } : {}),
      }
    }
    if (method === 'ping') return {}
    // eslint-disable-next-line no-unused-vars
    if (method === 'tools/list') return page(visible(tools).map(({ execute, available, ...tool }) => tool), params, 'tools')
    if (method === 'tools/call') {
      if (typeof params.name !== 'string' || (params.arguments !== undefined && !record(params.arguments))) invalid('Send a tool name and object arguments')
      const tool = visible(tools).find(item => item.name === params.name)
      if (!tool) invalid('Unknown or unavailable tool')
      const args = (params.arguments ?? {}) as JsonObject
      const errors = validateSchema(args, tool!.inputSchema)
      if (errors.length) invalid(errors.slice(0, 5).join('; '))
      try {
        context.signal.throwIfAborted()
        const result = await tool!.execute(args, context)
        if (tool!.outputSchema && !result.isError) {
          if (!result.structuredContent || validateSchema(result.structuredContent, tool!.outputSchema).length)
            throw new Error(`MCP output failed validation: ${tool!.name}`)
        }
        return result
      }
      catch (error) {
        options.onError?.(error, context)
        return { content: [{ type: 'text', text: 'The operation failed. Try again or check the application.' }], isError: true }
      }
    }
    // eslint-disable-next-line no-unused-vars
    if (method === 'resources/list') return page(visible(resources).map(({ read, available, ...resource }) => resource), params, 'resources')
    if (method === 'resources/templates/list') return { resourceTemplates: [] }
    if (method === 'resources/read') {
      if (typeof params.uri !== 'string') invalid('Send a resource URI')
      const resource = visible(resources).find(item => item.uri === params.uri)
      if (!resource) throw new ProtocolError(-32002, 'Unknown or unavailable resource')
      return { contents: [{ uri: resource.uri, mimeType: resource.mimeType ?? 'text/plain', text: await resource.read(context) }] }
    }
    // eslint-disable-next-line no-unused-vars
    if (method === 'prompts/list') return page(visible(prompts).map(({ get, available, ...prompt }) => prompt), params, 'prompts')
    if (method === 'prompts/get') {
      if (typeof params.name !== 'string' || (params.arguments !== undefined && !record(params.arguments))) invalid('Send a prompt name and string arguments')
      const prompt = visible(prompts).find(item => item.name === params.name)
      if (!prompt) invalid('Unknown or unavailable prompt')
      const args = (params.arguments ?? {}) as JsonObject
      const declared = prompt!.arguments ?? []
      if (Object.entries(args).some(([key, value]) => typeof value !== 'string' || (value as string).length > 16000 || !declared.some(arg => arg.name === key))) invalid('Invalid prompt arguments')
      if (declared.some(arg => arg.required && !args[arg.name])) invalid('Missing required prompt argument')
      return prompt!.get(args as Record<string, string>, context)
    }
    throw new ProtocolError(-32601, 'Method not found')
  }

  return {
    async handle(request: Request): Promise<Response> {
      const origin = request.headers.get('origin')
      if (origin && !options.allowedOrigins?.includes(origin))
        return failure(null, -32600, 'Origin is not allowed', 403)
      let principal: Principal | Response
      try { principal = await options.authenticate(request) }
      catch { return failure(null, -32603, 'Authentication service failed', 500) }
      if (principal instanceof Response) return principal
      const finish = (response: Response): Response => {
        if (options.responseHeaders) {
          new Headers(options.responseHeaders(principal)).forEach((value, key) => response.headers.set(key, value))
        }
        return response
      }
      if (request.method !== 'POST')
        return finish(json({ error: 'Use POST for this stateless MCP endpoint' }, 405, { Allow: 'POST' }))
      const version = request.headers.get('mcp-protocol-version')
      if (version && !(MCP_PROTOCOL_VERSIONS as readonly string[]).includes(version))
        return finish(failure(null, -32600, 'Unsupported MCP protocol version', 400))
      if (!accepts(request.headers.get('accept'), 'application/json') || !accepts(request.headers.get('accept'), 'text/event-stream'))
        return finish(failure(null, -32600, 'Accept must include application/json and text/event-stream', 406))
      let message: unknown
      try { message = await readJsonBody(request, maxBodyBytes) }
      catch (error) {
        if (error instanceof RequestBodyError) return finish(failure(null, -32700, error.message, error.status))
        return finish(failure(null, -32603, 'Could not read request body', 500))
      }
      if (!record(message) || message.jsonrpc !== '2.0' || typeof message.method !== 'string' || Object.hasOwn(message, 'result') || Object.hasOwn(message, 'error') || (message.params !== undefined && !record(message.params)))
        return finish(failure(null, -32600, 'Invalid JSON-RPC request', 400))
      if (!Object.hasOwn(message, 'id')) {
        if (!message.method.startsWith('notifications/')) return finish(failure(null, -32600, 'Requests require an id', 400))
        return finish(new Response(null, { status: 202, headers: { 'Cache-Control': 'no-store' } }))
      }
      const id = message.id
      if (typeof id !== 'string' && (typeof id !== 'number' || !Number.isSafeInteger(id)))
        return finish(failure(null, -32600, 'Request id must be a string or safe integer', 400))
      const context = { principal, request, signal: request.signal }
      try {
        const result = await dispatch(message.method, (message.params ?? {}) as JsonObject, context)
        return finish(json({ jsonrpc: '2.0', id, result }))
      }
      catch (error) {
        if (error instanceof ProtocolError) return finish(failure(id as string | number, error.code, error.message))
        options.onError?.(error, context)
        return finish(failure(id as string | number, -32603, 'Internal error'))
      }
    },
  }
}

export function mcpTextResult(data: JsonObject, isError = false): MCPServerToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data) }], structuredContent: data, ...(isError ? { isError: true } : {}) }
}
