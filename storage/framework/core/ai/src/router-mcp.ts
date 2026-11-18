import { createHash } from 'node:crypto'
import type { StacksRouterInstance } from '@stacksjs/router/runtime'
import { route as defaultRouter } from '@stacksjs/router/runtime'
import { readTextBody } from '@stacksjs/router/body'
import type { MCPServerContext, MCPServerOptions, MCPServerTool } from './mcp-server'
import { createMCPServer, mcpTextResult } from './mcp-server'

export interface MCPRouterRoute {
  method: string
  path: string
}

export interface RouterMCPServerOptions<Principal> extends MCPServerOptions<Principal> {
  router?: StacksRouterInstance
  /** Only this path and its descendants. Defaults to /api; use '' for all routes. */
  prefix?: string
  /** Canonical API origin for host-sensitive routes; dispatch still stays in-process. */
  origin?: string
  /** Further restrict the registered endpoints exposed as tools. */
  filter?: (route: MCPRouterRoute) => boolean
  /** Rename, describe, replace schemas/execution, set availability, or return false to omit. */
  configureTool?: (route: MCPRouterRoute, tool: MCPServerTool<Principal>) => MCPServerTool<Principal> | false
  /** Defaults to forwarding Authorization only. Never implicitly forwards session cookies. */
  requestHeaders?: (context: MCPServerContext<Principal>, route: MCPRouterRoute) => HeadersInit | Promise<HeadersInit>
  /** Maximum UTF-8 API response size. Defaults to 1 MiB. */
  maxResponseBytes?: number
}

function toolName(endpoint: MCPRouterRoute): string {
  const key = `${endpoint.method} ${endpoint.path}`
  const label = `${endpoint.method.toLowerCase()}_${endpoint.path.replace(/\{(\w+)\}/g, 'by_$1').replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '')}`
  return `${label.slice(0, 115)}_${createHash('sha256').update(key).digest('hex').slice(0, 12)}`
}

function inputSchema(endpoint: MCPRouterRoute): Record<string, unknown> {
  const params = [...endpoint.path.matchAll(/\{(\w+)\}/g)].map(match => match[1]!)
  const properties: Record<string, unknown> = {
    query: { type: 'object', description: 'Query parameters. Values may be strings, numbers, booleans, or arrays of these.' },
  }
  if (params.length) {
    properties.path = {
      type: 'object', properties: Object.fromEntries(params.map(name => [name, { type: ['string', 'number'], minLength: 1 }])),
      required: [...new Set(params)], additionalProperties: false,
    }
  }
  if (endpoint.method !== 'GET') properties.body = { description: 'JSON request body. The API applies its normal validation rules.' }
  return { type: 'object', properties, ...(params.length ? { required: ['path'] } : {}), additionalProperties: false }
}

/**
 * Generate MCP tools from this router's live API registrations, including useApi.
 * Snapshot on the first protocol request, after application and ORM routes load.
 * Calls re-enter the complete router pipeline; no HTTP fetch or handler bypass.
 */
export function createRouterMCPServer<Principal>(options: RouterMCPServerOptions<Principal>): ReturnType<typeof createMCPServer<Principal>> {
  const { router = defaultRouter, prefix = '/api', origin = 'http://stacks-mcp.internal', filter, configureTool, requestHeaders, maxResponseBytes = 1_048_576, ...transport } = options
  const protocol = {
    ...transport,
    allowedOrigins: transport.allowedOrigins ? [...transport.allowedOrigins] : undefined,
    tools: transport.tools?.map(tool => ({ ...tool, inputSchema: structuredClone(tool.inputSchema), outputSchema: tool.outputSchema ? structuredClone(tool.outputSchema) : undefined, annotations: tool.annotations ? { ...tool.annotations } : undefined, securitySchemes: tool.securitySchemes ? structuredClone(tool.securitySchemes) : undefined, _meta: tool._meta ? structuredClone(tool._meta) : undefined })),
    resources: transport.resources?.map(resource => ({ ...resource })),
    prompts: transport.prompts?.map(prompt => ({ ...prompt, arguments: prompt.arguments?.map(argument => ({ ...argument })) })),
  }
  if (!Number.isSafeInteger(maxResponseBytes) || maxResponseBytes < 1)
    throw new RangeError('MCP maxResponseBytes must be a positive safe integer')
  if (prefix && (!prefix.startsWith('/') || /[?#{}*]/.test(prefix)))
    throw new TypeError('MCP prefix must be an absolute route path')
  const apiOrigin = new URL(origin)
  if (!['http:', 'https:'].includes(apiOrigin.protocol) || apiOrigin.origin !== origin)
    throw new TypeError('MCP origin must be an exact HTTP(S) origin')
  const base = prefix.replace(/\/+$/, '')
  // Validate and snapshot the native transport options at construction too.
  const baseServer = createMCPServer(protocol)
  let server: ReturnType<typeof createMCPServer<Principal>> | undefined

  function generate(mcpPath: string): ReturnType<typeof createMCPServer<Principal>> {
    const endpoints = new Map<string, MCPRouterRoute>()
    for (const registered of router.routes) {
      const endpoint = { method: registered.method.toUpperCase(), path: registered.path }
      if (endpoint.path === mcpPath) continue
      if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(endpoint.method)) continue
      if (base && endpoint.path !== base && !endpoint.path.startsWith(`${base}/`)) continue
      // Wildcards, optional and constrained parameters are not concrete callable URLs.
      if (/[{}*?:#\\]/.test(endpoint.path.replace(/\{\w+\}/g, ''))) continue
      if (/(?:^|\/)(?:\.|%2e){1,2}(?=\/|$)/i.test(endpoint.path)) continue
      if (filter && !filter({ ...endpoint })) continue
      endpoints.set(`${endpoint.method} ${endpoint.path}`, endpoint)
    }
    const tools: MCPServerTool<Principal>[] = []
    for (const endpoint of [...endpoints.values()].sort((a, b) => `${a.path} ${a.method}`.localeCompare(`${b.path} ${b.method}`))) {
      const tool: MCPServerTool<Principal> = {
        name: toolName(endpoint), description: `${endpoint.method} ${endpoint.path}`,
        inputSchema: inputSchema(endpoint),
        annotations: { readOnlyHint: endpoint.method === 'GET', destructiveHint: endpoint.method !== 'GET', openWorldHint: false },
        async execute(args, context) {
          const pathArgs = (args.path ?? {}) as Record<string, unknown>
          const path = endpoint.path.replace(/\{(\w+)\}/g, (placeholder, name: string) => {
            const value = pathArgs[name]
            if (!['string', 'number'].includes(typeof value) || value === '' || value === '.' || value === '..')
              throw new TypeError(`Invalid path parameter: ${placeholder}`)
            return encodeURIComponent(String(value))
          })
          // This fixed origin is only a URL container. Dispatch stays in-process.
          const url = new URL(`${origin}${path}`)
          for (const [key, value] of Object.entries((args.query ?? {}) as Record<string, unknown>)) {
            for (const item of Array.isArray(value) ? value : [value]) {
              if (!['string', 'number', 'boolean'].includes(typeof item)) throw new TypeError(`Invalid query parameter: ${key}`)
              url.searchParams.append(key, String(item))
            }
          }
          const headers = new Headers(requestHeaders ? await requestHeaders(context, { ...endpoint }) : undefined)
          if (!requestHeaders) {
            const authorization = context.request.headers.get('authorization')
            if (authorization) headers.set('Authorization', authorization)
          }
          headers.set('Accept', 'application/json')
          const hasBody = endpoint.method !== 'GET' && Object.hasOwn(args, 'body')
          if (hasBody) headers.set('Content-Type', 'application/json')
          const response = await router.handleRequest(new Request(url, {
            method: endpoint.method, headers, signal: context.signal,
            ...(hasBody ? { body: JSON.stringify(args.body) } : {}),
          }))
          if (response.status >= 500) {
            await response.body?.cancel()
            return mcpTextResult({ status: response.status, body: 'The API request failed.' }, true)
          }
          if (response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() === 'text/event-stream') {
            await response.body?.cancel()
            return mcpTextResult({ status: response.status, body: 'Streaming API responses are not supported.' }, true)
          }
          let body: unknown = null
          if (response.body) {
            // pipeThrough cancels the source and rejects a blocked read on abort.
            const bodyStream = response.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>(), { signal: context.signal })
            const text = await readTextBody(new Request(url, { method: 'POST', body: bodyStream, signal: context.signal }), maxResponseBytes)
            if (text) {
              try { body = JSON.parse(text) }
              catch { body = text }
            }
          }
          return mcpTextResult({ status: response.status, body }, !response.ok)
        },
      }
      const configured = configureTool ? configureTool({ ...endpoint }, tool) : tool
      if (configured) tools.push(configured)
    }
    return createMCPServer({ ...protocol, tools: [...tools, ...(protocol.tools ?? [])] })
  }

  return {
    handle(request) {
      // GET and DELETE keep the native method policy without freezing discovery early.
      if (request.method !== 'POST') return baseServer.handle(request)
      server ??= generate(new URL(request.url).pathname)
      return server.handle(request)
    },
  }
}

/** One-call registration, usable in routes/api.ts or a prefixed route group. */
export function mountRouterMCPServer<Principal>(options: RouterMCPServerOptions<Principal> & { path?: string }): ReturnType<typeof createMCPServer<Principal>> {
  const { path = '/mcp', router = defaultRouter, filter, ...rest } = options
  const endpoints = new Set<string>()
  const server = createRouterMCPServer({ ...rest, router, filter: endpoint => !endpoints.has(endpoint.path) && (!filter || filter(endpoint)) })
  const start = router.routes.length
  router.post(path, server.handle).parseBody(false).skipCsrf()
  router.get(path, server.handle)
  router.delete(path, server.handle).skipCsrf()
  for (const endpoint of router.routes.slice(start)) endpoints.add(endpoint.path)
  return server
}
