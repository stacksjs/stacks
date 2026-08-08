import type { OpenApiDocument, SchemaObject } from './generate-types'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { schemaType } from './generate-types'

/**
 * A TypeScript client, generated from the OpenAPI document.
 *
 * Generated rather than maintained by hand for the reason the document itself
 * is generated: a hand-written client is a second description of the API, and
 * the second description is always the one that is wrong. It drifts on the day
 * somebody adds an endpoint, and nothing fails - the client simply does not
 * have it, which reads as "the API cannot do that".
 *
 * The output has **no dependencies and no imports**. It is one file that can be
 * copied into a browser app, a Bun script, or another repository entirely, and
 * it uses `fetch` from the environment. A generated client that requires a
 * runtime package pins its consumer to this framework's release cadence, which
 * is precisely the coupling a client is supposed to remove.
 */

interface OpenApiParameter {
  name: string
  in: string
  required?: boolean
  schema?: SchemaObject
  description?: string
}

interface OpenApiOperation {
  summary?: string
  description?: string
  operationId?: string
  parameters?: OpenApiParameter[]
  requestBody?: { required?: boolean, content?: Record<string, { schema?: SchemaObject }> }
  responses?: Record<string, { description?: string, content?: Record<string, { schema?: SchemaObject }> }>
}

const METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch'] as const

/**
 * A readable method name for an operation.
 *
 * `get__api_repos_pulls_show` is what the generator produces when a route has
 * no name, and `client.get__api_repos_pulls_show()` is a name nobody would
 * write on purpose. Split it, drop the `api` prefix every route shares, and
 * camel-case the rest: `getReposPullsShow`.
 *
 * A path parameter contributes its name (`{id}` → `ById`), because
 * `getRepository` and `getRepositoryById` are two different operations and
 * numbering the second one tells the reader nothing.
 */
export function methodName(operationId: string): string {
  const parts = operationId
    .replace(/[{}]/g, '')
    .split(/[^a-z0-9]+/i)
    .filter(Boolean)

  // `api` only where every route carries it - as a prefix. A path segment
  // genuinely called `api` deeper in is part of the name.
  const trimmed = parts[0]?.toLowerCase() === 'api'
    ? parts.slice(1)
    : parts[1]?.toLowerCase() === 'api' ? [parts[0]!, ...parts.slice(2)] : parts

  const [first, ...rest] = trimmed
  if (!first) return 'call'

  const head = first.charAt(0).toLowerCase() + first.slice(1)
  const tail = rest.map(part => part.charAt(0).toUpperCase() + part.slice(1))
  const name = [head, ...tail].join('')

  // A name that begins with a digit is not an identifier.
  return /^[a-z_$]/i.test(name) ? name : `call${name.charAt(0).toUpperCase()}${name.slice(1)}`
}

/** The 2xx response body type, or `unknown` when the document does not say. */
function successType(operation: OpenApiOperation): string {
  const responses = operation.responses ?? {}
  const status = Object.keys(responses).find(code => code.startsWith('2'))
  if (!status) return 'unknown'

  const content = responses[status]?.content
  const json = content?.['application/json'] ?? Object.values(content ?? {})[0]

  return json?.schema ? schemaType(json.schema) : 'unknown'
}

function comment(lines: string[], indent = '  '): string {
  const kept = lines.filter(Boolean)
  if (!kept.length) return ''
  return `${indent}/**\n${kept.map(line => `${indent} * ${line}`).join('\n')}\n${indent} */\n`
}

function renderOperation(route: string, method: string, operation: OpenApiOperation, name: string): string {
  const parameters = operation.parameters ?? []
  const pathParams = parameters.filter(parameter => parameter.in === 'path')
  const queryParams = parameters.filter(parameter => parameter.in === 'query')

  const bodySchema = operation.requestBody?.content?.['application/json']?.schema
  const bodyRequired = Boolean(operation.requestBody?.required)

  const fields: string[] = []
  for (const parameter of [...pathParams, ...queryParams]) {
    // A path parameter is always required: it is part of the URL, and a URL
    // with `{id}` still in it is a 404 with a confusing message.
    const required = parameter.in === 'path' || parameter.required
    fields.push(`${JSON.stringify(parameter.name)}${required ? '' : '?'}: ${schemaType(parameter.schema)}`)
  }
  if (bodySchema)
    fields.push(`body${bodyRequired ? '' : '?'}: ${schemaType(bodySchema)}`)

  const everyFieldOptional = [...pathParams, ...queryParams].every(p => p.in !== 'path' && !p.required)
    && (!bodySchema || !bodyRequired)

  const argument = fields.length
    ? `input${everyFieldOptional ? '?' : ''}: { ${fields.join('; ')} }, `
    : ''

  const queryList = queryParams.length
    ? `[${queryParams.map(parameter => JSON.stringify(parameter.name)).join(', ')}]`
    : '[]'

  const documentation = comment([
    operation.summary && operation.summary !== route ? operation.summary : `${method.toUpperCase()} ${route}`,
    operation.description ?? '',
  ])

  return `${documentation}  ${name}(${argument}options?: RequestOptions): Promise<ApiResult<${successType(operation)}>> {
    return request(config, ${JSON.stringify(method.toUpperCase())}, ${JSON.stringify(route)}, ${fields.length ? 'input ?? {}' : '{}'}, ${queryList}, ${bodySchema ? 'true' : 'false'}, options)
  },`
}

/**
 * Render the client for a document.
 *
 * Exported separately from the file writing so it can be tested on a document
 * built in memory, which is the only way to assert what it does with a shape
 * the current app happens not to have.
 */
export function renderApiClient(document: OpenApiDocument, options: { name?: string } = {}): string {
  const title = options.name ?? 'API'

  const used = new Map<string, number>()
  const methods: string[] = []

  for (const [route, item] of Object.entries(document.paths ?? {})) {
    for (const method of METHODS) {
      const operation = (item as Record<string, OpenApiOperation | undefined>)[method]
      if (!operation) continue

      const preferred = methodName(operation.operationId ?? `${method}_${route}`)
      const seen = used.get(preferred) ?? 0
      used.set(preferred, seen + 1)

      // A collision keeps both operations reachable. Dropping one would make
      // the client quietly incapable of calling an endpoint that exists.
      methods.push(renderOperation(route, method, operation, seen === 0 ? preferred : `${preferred}${seen + 1}`))
    }
  }

  return `/* eslint-disable */
/**
 * ${title} client, generated from the OpenAPI document.
 *
 * Do not edit. Run \`buddy generate:openapi\` to rebuild it from the routes.
 *
 * No imports and no dependencies: copy this file anywhere that has \`fetch\`.
 */

/** Every call answers with one of these. Nothing here throws for a 4xx. */
export type ApiResult<T> =
  | { ok: true, status: number, data: T, headers: Headers }
  | { ok: false, status: number, error: unknown, headers: Headers }

export interface ClientConfig {
  /** Where the API lives, e.g. \`https://example.com\`. No trailing slash needed. */
  baseUrl: string
  /** Sent as \`Authorization: Bearer …\` when present. */
  token?: string
  /** Extra headers on every request. */
  headers?: Record<string, string>
  /** Swap in a different fetch - a test double, or one that retries. */
  fetch?: typeof fetch
}

export interface RequestOptions {
  /** Abort in flight. */
  signal?: AbortSignal
  /** Headers for this call only, merged over the client's. */
  headers?: Record<string, string>
}

function buildUrl(config: ClientConfig, route: string, input: Record<string, unknown>, query: string[]): string {
  // Path parameters are substituted, never appended: a \`{id}\` left in the URL
  // is a 404 whose message is about the literal string "{id}".
  const filled = route.replace(/\\{(\\w+)\\}/g, (_, key: string) => encodeURIComponent(String(input[key] ?? '')))
  const url = new URL(filled.replace(/^\\/+/, '/'), config.baseUrl.endsWith('/') ? config.baseUrl : \`\${config.baseUrl}/\`)

  for (const key of query) {
    const value = input[key]
    // Absent means absent. Sending \`?path=\` asks for the file called empty
    // string, which is a different question from not filtering.
    if (value === undefined || value === null) continue
    url.searchParams.set(key, String(value))
  }

  return url.toString()
}

async function request<T>(
  config: ClientConfig,
  method: string,
  route: string,
  input: Record<string, unknown>,
  query: string[],
  hasBody: boolean,
  options?: RequestOptions,
): Promise<ApiResult<T>> {
  const call = config.fetch ?? fetch
  const url = buildUrl(config, route, input, query)

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(config.headers ?? {}),
    ...(options?.headers ?? {}),
  }
  if (config.token) headers.Authorization = \`Bearer \${config.token}\`

  const body = hasBody && input.body !== undefined ? JSON.stringify(input.body) : undefined
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  const response = await call(url, { method, headers, body, signal: options?.signal })

  const text = await response.text()
  let parsed: unknown = text
  if (text.length) {
    // A non-JSON body is kept verbatim rather than replaced with a parse error.
    // An endpoint that answered with HTML is worth seeing.
    try { parsed = JSON.parse(text) } catch { parsed = text }
  }
  else {
    parsed = null
  }

  return response.ok
    ? { ok: true, status: response.status, data: parsed as T, headers: response.headers }
    : { ok: false, status: response.status, error: parsed, headers: response.headers }
}

export function createClient(config: ClientConfig) {
  return {
    /** The configuration in use, so a caller can rebuild a variant of it. */
    config,

${methods.join('\n\n')}
  }
}

export type Client = ReturnType<typeof createClient>
`
}

if (import.meta.main) {
  const apiRoot = resolve(import.meta.dir, '../../../api')
  const input = resolve(process.argv[2] || resolve(apiRoot, 'openapi.json'))
  const output = resolve(process.argv[3] || resolve(apiRoot, 'client.ts'))
  const document = JSON.parse(readFileSync(input, 'utf8')) as OpenApiDocument
  writeFileSync(output, renderApiClient(document))
  console.log(`Generated ${output}`)
}
