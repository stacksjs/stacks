import type { OpenApiDocument, OpenApiOperation, OpenApiParameter, OpenApiPathItem, OpenApiRequestBody, OpenApiResponse, SchemaObject } from './generate-types'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { clientRuntime } from './client-runtime'
import { operationParameters, renderSchemaComponents, resolveOpenApiReference, schemaType } from './generate-types'

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

function successType(operation: OpenApiOperation, document: OpenApiDocument, method: string): string {
  if (method === 'head') return 'null'
  const types: string[] = []
  for (const [status, entry] of Object.entries(operation.responses ?? {})) {
    if (!/^2(?:\d\d|XX)$/i.test(status)) continue
    const response = resolveOpenApiReference<OpenApiResponse>(entry, document)
    if (status === '204' || status === '205' || !Object.keys(response.content ?? {}).length) types.push('null')
    else for (const media of Object.values(response.content ?? {})) types.push(schemaType(media.schema, { document, direction: 'response' }))
  }
  return types.includes('unknown') ? 'unknown' : [...new Set(types)].join(' | ') || 'unknown'
}

/** Documentation is data, including embedded newlines and comment terminators. */
function comment(lines: string[], indent = '  '): string {
  const kept = lines.filter(Boolean).flatMap(line => line.replace(/\*\//g, '*\\/').split(/\r?\n/))
  return kept.length ? `${indent}/**\n${kept.map(line => `${indent} * ${line}`).join('\n')}\n${indent} */\n` : ''
}

function renderOperation(route: string, method: string, operation: OpenApiOperation, item: OpenApiPathItem, name: string, document: OpenApiDocument): string {
  const parameters = operationParameters(item, operation, document)
  const body = operation.requestBody && resolveOpenApiReference<OpenApiRequestBody>(operation.requestBody, document)
  const pathAndQuery = parameters.filter(parameter => parameter.in === 'path' || parameter.in === 'query')
  const names = pathAndQuery.map(parameter => parameter.name)
  const grouped = new Set(names).size !== names.length
    || (Boolean(body) && names.includes('body'))
    || (parameters.some(parameter => parameter.in === 'header') && names.includes('headers'))
  const descriptors = parameters.map((parameter) => {
    const styles = parameter.in === 'query' ? ['form', 'deepObject', 'spaceDelimited', 'pipeDelimited'] : ['simple']
    if (!['path', 'query', 'header'].includes(parameter.in) || (parameter.style && !styles.includes(parameter.style)))
      throw new TypeError(`Unsupported parameter serialization: ${parameter.in} ${parameter.style ?? ''}`)
    return { name: parameter.name, in: parameter.in, required: parameter.in === 'path' || Boolean(parameter.required),
      ...(parameter.in === 'header' ? { group: 'headers' } : grouped ? { group: parameter.in } : {}),
      ...(parameter.style ? { style: parameter.style } : {}), ...(parameter.explode !== undefined ? { explode: parameter.explode } : {}) }
  })
  const fields: string[] = []
  const required = (parameter: OpenApiParameter) => parameter.in === 'path' || parameter.required
  const field = (parameter: OpenApiParameter) => `${JSON.stringify(parameter.name)}${required(parameter) ? '' : '?'}: ${schemaType(parameter.schema, { document, direction: 'request' })}`
  if (!grouped) fields.push(...pathAndQuery.map(field))
  for (const location of [...(grouped ? ['path', 'query'] : []), 'header']) {
    const entries = parameters.filter(parameter => parameter.in === location)
    if (entries.length) fields.push(`${location === 'header' ? 'headers' : location}${entries.some(required) ? '' : '?'}: { ${entries.map(field).join('; ')} }`)
  }
  const content = Object.keys(body?.content ?? {})
  if (body && !content.length) throw new TypeError('Request body must declare a media type')
  if (body) {
    const bodyTypes = Object.entries(body.content ?? {}).map(([type, media]) => {
      const shape = schemaType(media.schema, { document, direction: 'request' })
      return type === 'multipart/form-data' ? `${shape} | FormData` : shape
    })
    fields.push(`body${body.required ? '' : '?'}: ${[...new Set(bodyTypes)].join(' | ')}`)
  }
  const everyFieldOptional = !parameters.some(required) && !body?.required
  const argument = fields.length ? `input${everyFieldOptional ? '?' : ''}: { ${fields.join('; ')} }, ` : ''
  const documentation = comment([operation.summary && operation.summary !== route ? operation.summary : `${method.toUpperCase()} ${route}`, operation.description ?? ''])
  const accept = [...new Set(Object.values(operation.responses ?? {}).flatMap(entry => Object.keys(resolveOpenApiReference<OpenApiResponse>(entry, document).content ?? {})))].join(', ') || 'application/json'
  const binary = [...new Set(Object.values(operation.responses ?? {}).flatMap(entry => Object.entries(resolveOpenApiReference<OpenApiResponse>(entry, document).content ?? {}).filter(([, media]) => {
    const schema = resolveOpenApiReference<SchemaObject>(media.schema ?? {}, document)
    return schema.type === 'string' && schema.format === 'binary'
  }).map(([type]) => type.split(';')[0]!.trim().toLowerCase()))) ]
  return `${documentation}  ${name}(${argument}options?: RequestOptions): Promise<ApiResult<${successType(operation, document, method)}>> {
    return request(config, ${JSON.stringify(method.toUpperCase())}, ${JSON.stringify(route)}, ${fields.length ? 'input ?? {}' : '{}'}, ${JSON.stringify(descriptors)}, ${body ? JSON.stringify({ required: Boolean(body.required), content }) : 'null'}, ${JSON.stringify(accept)}, ${JSON.stringify(binary)}, options)
  },`
}

export function renderApiClient(document: OpenApiDocument, options: { name?: string } = {}): string {
  const operations = Object.entries(document.paths ?? {}).flatMap(([route, item]) => METHODS.flatMap((method) => {
    const operation = item[method] as OpenApiOperation | undefined
    return operation ? [{ route, item, method, operation, preferred: methodName(operation.operationId ?? `${method}_${route}`) }] : []
  }))
  const reserved = new Set(['config', 'then', 'constructor', 'prototype', '__proto__'])
  const preferred = new Set(operations.map(operation => operation.preferred))
  const used = new Set(reserved)
  const methods = operations.map((entry) => {
    let name = entry.preferred
    let suffix = 2
    if (used.has(name)) {
      do { name = `${entry.preferred}${suffix++}` } while (used.has(name) || preferred.has(name))
    }
    used.add(name)
    return renderOperation(entry.route, entry.method, entry.operation, entry.item, name, document)
  })
  return `/* eslint-disable */
${comment([`${options.name ?? 'API'} client, generated from OpenAPI.`, 'Do not edit; run buddy generate:openapi.', 'No imports or dependencies.'], '')}
${clientRuntime}
${renderSchemaComponents(document)}

export function createClient(config: ClientConfig) {
  return {
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
