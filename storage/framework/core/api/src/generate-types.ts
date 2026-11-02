import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

export interface SchemaObject {
  [key: string]: unknown
  $ref?: string
  type?: string
  nullable?: boolean
  readOnly?: boolean
  writeOnly?: boolean
  enum?: unknown[]
  properties?: Record<string, SchemaObject>
  required?: string[]
  items?: SchemaObject
  additionalProperties?: boolean | SchemaObject
  oneOf?: SchemaObject[]
  anyOf?: SchemaObject[]
  allOf?: SchemaObject[]
}

export interface OpenApiReference { $ref: string }
export interface OpenApiParameter {
  name: string
  in: string
  required?: boolean
  schema?: SchemaObject
  description?: string
  style?: string
  explode?: boolean
}
export interface OpenApiMedia { schema?: SchemaObject }
export interface OpenApiRequestBody { required?: boolean, content?: Record<string, OpenApiMedia> }
export interface OpenApiResponse { description?: string, content?: Record<string, OpenApiMedia> }
export interface OpenApiOperation {
  operationId?: string
  summary?: string
  description?: string
  parameters?: Array<OpenApiParameter | OpenApiReference>
  requestBody?: OpenApiRequestBody | OpenApiReference
  responses?: Record<string, OpenApiResponse | OpenApiReference>
}
export interface OpenApiPathItem {
  [key: string]: unknown
  parameters?: Array<OpenApiParameter | OpenApiReference>
  get?: OpenApiOperation
  put?: OpenApiOperation
  post?: OpenApiOperation
  delete?: OpenApiOperation
  options?: OpenApiOperation
  head?: OpenApiOperation
  patch?: OpenApiOperation
  trace?: OpenApiOperation
}
export interface OpenApiDocument {
  paths?: Record<string, OpenApiPathItem>
  components?: {
    schemas?: Record<string, SchemaObject>
    parameters?: Record<string, OpenApiParameter | OpenApiReference>
    requestBodies?: Record<string, OpenApiRequestBody | OpenApiReference>
    responses?: Record<string, OpenApiResponse | OpenApiReference>
  }
}
export interface SchemaTypeOptions {
  document?: OpenApiDocument
  direction?: 'request' | 'response'
}
const methods = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'] as const

/** Local JSON references only. Missing, external and cyclic aliases fail during generation. */
export function resolveOpenApiReference<T extends object>(value: T | OpenApiReference, document: OpenApiDocument): T {
  const visited = new Set<string>()
  let current: unknown = value
  while (current && typeof current === 'object' && '$ref' in current) {
    const ref = (current as OpenApiReference).$ref
    if (!ref.startsWith('#/') || visited.has(ref)) throw new TypeError(`Unsupported or cyclic OpenAPI reference: ${ref}`)
    visited.add(ref)
    let target: unknown = document
    for (const key of decodeURIComponent(ref.slice(2)).split('/').map(part => part.replace(/~1/g, '/').replace(/~0/g, '~'))) {
      if (!target || typeof target !== 'object' || !Object.hasOwn(target, key)) throw new TypeError(`Missing OpenAPI reference: ${ref}`)
      target = (target as Record<string, unknown>)[key]
    }
    current = target
  }
  if (!current || typeof current !== 'object' || Array.isArray(current)) throw new TypeError('OpenAPI reference must resolve to an object')
  return current as T
}

/** Parameters are unique by location and name; operation declarations override inherited ones. */
export function operationParameters(item: OpenApiPathItem, operation: OpenApiOperation, document: OpenApiDocument): OpenApiParameter[] {
  const parameters = new Map<string, OpenApiParameter>()
  for (const entry of [...(item.parameters ?? []), ...(operation.parameters ?? [])]) {
    const parameter = resolveOpenApiReference<OpenApiParameter>(entry, document)
    const name = parameter.in === 'header' ? parameter.name.toLowerCase() : parameter.name
    parameters.set(`${parameter.in}:${name}`, parameter)
  }
  return [...parameters.values()]
}

function literal(value: unknown, ancestors = new Set<object>()): string {
  if (value === null) return 'null'
  if (typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'boolean') return String(value)
  if (!value || typeof value !== 'object' || ancestors.has(value)) throw new TypeError('OpenAPI enums must contain finite JSON values')
  ancestors.add(value)
  try {
    if (Array.isArray(value)) return `[${value.map(item => literal(item, ancestors)).join(', ')}]`
    return `{ ${Object.entries(value).map(([key, item]) => `${JSON.stringify(key)}: ${literal(item, ancestors)}`).join('; ')} }`
  }
  finally { ancestors.delete(value) }
}

function union(types: string[]): string {
  return types.includes('unknown') ? 'unknown' : [...new Set(types)].join(' | ') || 'never'
}

/** Render schemas for their use in a request or response, preserving recursive component references. */
export function schemaType(schema?: SchemaObject, options: SchemaTypeOptions = {}): string {
  return renderSchema(schema, options, new Set())
}

function renderSchema(schema: SchemaObject | undefined, options: SchemaTypeOptions, ancestors: Set<object>): string {
  if (!schema) return 'unknown'
  if (ancestors.has(schema)) throw new TypeError('Recursive schemas must use component references')
  ancestors.add(schema)
  const render = (value?: SchemaObject) => renderSchema(value, options, ancestors)
  try {
    if (schema.$ref) {
      if (!options.document || !schema.$ref.startsWith('#/components/schemas/')) throw new TypeError(`Unsupported schema reference: ${schema.$ref}`)
      resolveOpenApiReference<SchemaObject>(schema, options.document)
      const pointer = decodeURIComponent(schema.$ref.slice('#/components/schemas/'.length))
      if (pointer.includes('/')) return render(resolveOpenApiReference<SchemaObject>(schema, options.document))
      const name = pointer.replace(/~1/g, '/').replace(/~0/g, '~')
      return `components[${JSON.stringify(options.direction === 'request' ? 'requestSchemas' : 'schemas')}][${JSON.stringify(name)}]`
    }
    // An enum still constrains nullable schemas: null must itself be an enum member.
    if (schema.enum?.length) return union(schema.enum.map(value => literal(value)))
    let base: string | undefined
    if (schema.type === 'string') base = schema.format === 'binary' ? 'Blob' : 'string'
    else if (schema.type === 'number' || schema.type === 'integer') base = 'number'
    else if (schema.type === 'boolean') base = 'boolean'
    else if (schema.type === 'null') base = 'null'
    else if (schema.type === 'array') base = `Array<${render(schema.items)}>`
    else if (schema.type === 'object' || schema.properties || schema.additionalProperties !== undefined) {
      const required = new Set(schema.required ?? [])
      const properties = Object.entries(schema.properties ?? {}).filter(([, value]) => {
        const resolved = value.$ref && options.document ? resolveOpenApiReference<SchemaObject>(value, options.document) : value
        return !(options.direction === 'request' && resolved.readOnly) && !(options.direction === 'response' && resolved.writeOnly)
      })
      const propertyTypes = properties.map(([name, value]) => ({ name, type: render(value), optional: !required.has(name) }))
      const fields = propertyTypes.map(({ name, type, optional }) => `${JSON.stringify(name)}${optional ? '?' : ''}: ${type}`)
      if (schema.additionalProperties) {
        const extra = schema.additionalProperties === true ? 'unknown' : render(schema.additionalProperties)
        // TypeScript index signatures also cover named fields. Widen the index
        // to keep valid OpenAPI objects compilable; runtime validation owns exact extras.
        const index = union([extra, ...propertyTypes.map(field => field.type), ...(propertyTypes.some(field => field.optional) ? ['undefined'] : [])])
        fields.push(`[key: string]: ${index}`)
      }
      base = fields.length ? `{ ${fields.join('; ')} }` : schema.additionalProperties === false ? 'Record<string, never>' : 'Record<string, unknown>'
    }
    const composed: string[] = []
    if (base) composed.push(base)
    for (const variants of [schema.oneOf, schema.anyOf]) {
      if (variants?.length) composed.push(union(variants.map(render)))
    }
    if (schema.allOf?.length) composed.push(...schema.allOf.map(render))
    const result = composed.length > 1 ? composed.map(type => `(${type})`).join(' & ') : composed[0] ?? 'unknown'
    return schema.nullable && schema.type ? union([result, 'null']) : result
  }
  finally { ancestors.delete(schema) }
}

export function renderSchemaComponents(document: OpenApiDocument): string {
  const map = (direction: 'request' | 'response') => Object.entries(document.components?.schemas ?? {}).map(([name, schema]) =>
    `    ${JSON.stringify(name)}: ${schemaType(schema, { document, direction })}`,
  ).join('\n')
  return `export interface components {\n  schemas: {\n${map('response')}\n  }\n  requestSchemas: {\n${map('request')}\n  }\n}`
}

function parameterGroups(parameters: OpenApiParameter[], document: OpenApiDocument): string {
  const groups = ['query', 'header', 'path', 'cookie'].map((location) => {
    const entries = parameters.filter(parameter => parameter.in === location)
    if (!entries.length) return `      ${location}?: never`
    const required = (parameter: OpenApiParameter) => parameter.in === 'path' || parameter.required
    const fields = entries.map(parameter => `${JSON.stringify(parameter.name)}${required(parameter) ? '' : '?'}: ${schemaType(parameter.schema, { document, direction: 'request' })}`)
    return `      ${location}${entries.every(parameter => !required(parameter)) ? '?' : ''}: { ${fields.join('; ')} }`
  })
  return `    parameters: {\n${groups.join('\n')}\n    }`
}

function contentTypes(content: Record<string, OpenApiMedia> | undefined, document: OpenApiDocument, direction: 'request' | 'response'): string {
  if (!content || !Object.keys(content).length) return 'never'
  return `{ ${Object.entries(content).map(([type, value]) => `${JSON.stringify(type)}: ${schemaType(value.schema, { document, direction })}`).join('; ')} }`
}

function renderOperation(item: OpenApiPathItem, operation: OpenApiOperation, document: OpenApiDocument): string {
  const body = operation.requestBody && resolveOpenApiReference<OpenApiRequestBody>(operation.requestBody, document)
  const requestBody = body
    ? `\n    requestBody${body.required ? '' : '?'}: { content: ${contentTypes(body.content, document, 'request')} }`
    : '\n    requestBody?: never'
  const responses = Object.entries(operation.responses ?? {}).map(([status, entry]) => {
    const response = resolveOpenApiReference<OpenApiResponse>(entry, document)
    return `      ${JSON.stringify(status)}: { content: ${contentTypes(response.content, document, 'response')} }`
  })
  return `{\n${parameterGroups(operationParameters(item, operation, document), document)}${requestBody}\n    responses: {\n${responses.join('\n')}\n    }\n  }`
}

export function renderOpenApiTypes(document: OpenApiDocument): string {
  const paths = Object.entries(document.paths ?? {}).map(([route, item]) => {
    const operations = methods.map((method) => {
      const operation = item[method] as OpenApiOperation | undefined
      return operation ? `    ${method}: ${renderOperation(item, operation, document)}` : `    ${method}?: never`
    })
    return `  ${JSON.stringify(route)}: {\n${operations.join('\n')}\n  }`
  })
  return `/** Generated from OpenAPI. Do not edit; run buddy generate:openapi. */\n\nexport interface paths {\n${paths.join('\n')}\n}\n\n${renderSchemaComponents(document)}\n`
}

if (import.meta.main) {
  const apiRoot = resolve(import.meta.dir, '../../../api')
  const input = resolve(process.argv[2] || resolve(apiRoot, 'openapi.json'))
  const output = resolve(process.argv[3] || resolve(apiRoot, 'api-types.ts'))
  const document = JSON.parse(readFileSync(input, 'utf8')) as OpenApiDocument
  writeFileSync(output, renderOpenApiTypes(document))
  console.log(`Generated ${output}`)
}
