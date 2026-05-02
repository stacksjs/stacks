import { path } from '@stacksjs/path'

interface OpenApiPathItem {
  [method: string]: {
    summary?: string
    operationId?: string
    parameters?: Array<{ name: string, in: string, required: boolean, schema: { type: string } }>
    responses: Record<string, { description: string, content?: Record<string, unknown> }>
    requestBody?: { content: Record<string, unknown>, required?: boolean }
  }
}

interface OpenApiSpec {
  openapi: string
  info: { title: string, version: string }
  paths: Record<string, OpenApiPathItem>
  components: { schemas: Record<string, unknown> }
}

/**
 * Map a Stacks validation rule to an OpenAPI 3.0 schema fragment.
 *
 * The validation library wraps rules in a Validator object whose
 * shape isn't formally typed at this boundary, so we duck-type the
 * common fields: `_type` ('string'|'number'|'boolean'|'array'|'object'),
 * `_required`, plus method-chain hints (`_email`, `_url`, `_min`,
 * `_max`). This is best-effort — anything we don't recognize falls
 * through as `{ type: 'string' }` so the spec stays valid even when
 * we can't precisely describe the rule.
 */
function ruleToSchema(rule: unknown): Record<string, unknown> {
  if (!rule || typeof rule !== 'object') return { type: 'string' }
  const r = rule as Record<string, unknown>
  const type = (r._type as string) ?? 'string'
  const out: Record<string, unknown> = { type: type === 'array' ? 'array' : type }
  if (typeof r._min === 'number') {
    out[type === 'string' ? 'minLength' : 'minimum'] = r._min
  }
  if (typeof r._max === 'number') {
    out[type === 'string' ? 'maxLength' : 'maximum'] = r._max
  }
  if (r._email) out.format = 'email'
  if (r._url) out.format = 'uri'
  if (r._uuid) out.format = 'uuid'
  if (Array.isArray(r._enum)) out.enum = r._enum
  return out
}

/**
 * Try to resolve an action's validations object given its handler
 * path string (e.g. 'Actions/CreatePostAction'). Returns `null` on
 * any resolution failure so generation never crashes the spec build.
 */
async function loadActionValidations(handlerPath: string): Promise<Record<string, unknown> | null> {
  if (typeof handlerPath !== 'string' || !handlerPath.includes('Actions')) return null
  try {
    const { path: p } = await import('@stacksjs/path')
    const candidates = [
      p.appPath(`${handlerPath}.ts`),
      p.storagePath(`framework/defaults/app/${handlerPath}.ts`),
    ]
    for (const candidate of candidates) {
      try {
        const file = Bun.file(candidate)
        if (!(await file.exists())) continue
        const mod = await import(candidate)
        const action = (mod as { default?: unknown }).default
        if (action && typeof action === 'object' && 'validations' in (action as Record<string, unknown>)) {
          const v = (action as Record<string, unknown>).validations
          return v && typeof v === 'object' ? (v as Record<string, unknown>) : null
        }
        return null
      }
      catch { /* try next candidate */ }
    }
  }
  catch { /* path package or fs unavailable — best-effort */ }
  return null
}

/**
 * Build an OpenAPI 3.0 spec from the live route registry.
 *
 * The previous shape called `route.routes()` (which doesn't exist —
 * `routes` is a getter, not a callable) and read fields like
 * `route.url`, `route.statusCode`, `route.responseSchema` that the
 * underlying bun-router doesn't actually expose. This rewrite uses
 * `listRegisteredRoutes()` (the canonical introspection helper) and
 * derives request schemas from each action's `validations` block when
 * available.
 *
 * Without `Action.validations`, the spec lists the path + parameters
 * but omits a request body schema — that's still useful for clients
 * that just want to know what endpoints exist.
 */
export async function generateOpenApi(): Promise<OpenApiSpec> {
  const { listRegisteredRoutes } = await import('@stacksjs/router')
  const routes = listRegisteredRoutes()

  const spec: OpenApiSpec = {
    openapi: '3.0.0',
    info: { title: 'Stacks API', version: '1.0.0' },
    paths: {},
    components: { schemas: {} },
  }

  for (const r of routes) {
    // Convert `:id` style to OpenAPI `{id}` style so the spec validates.
    const oasPath = r.path.replace(/(^|\/):(\w+)(?=$|\/)/g, '$1{$2}')
    if (!spec.paths[oasPath]) spec.paths[oasPath] = {}

    const paramNames: string[] = []
    for (const m of r.path.matchAll(/\{(\w+)\}/g)) {
      if (m[1]) paramNames.push(m[1])
    }
    for (const m of r.path.matchAll(/(?:^|\/):(\w+)(?=$|\/)/g)) {
      if (m[1]) paramNames.push(m[1])
    }

    // Try to resolve the action behind this route via the route name —
    // most projects use the convention `route.<METHOD>('/path', 'Actions/<Name>').name('foo')`
    // and the action lives at `app/Actions/<Name>.ts`. We only attempt
    // this for non-GET requests, since GET typically has no body.
    const method = r.method.toLowerCase()
    const op: OpenApiPathItem[string] = {
      summary: r.name ?? r.path,
      operationId: r.name ?? `${method}_${oasPath.replace(/[^a-z0-9]/gi, '_')}`,
      parameters: paramNames.map(name => ({
        name,
        in: 'path',
        required: true,
        schema: { type: 'string' },
      })),
      responses: {
        200: {
          description: 'Successful response',
          content: { 'application/json': { schema: { type: 'object' } } },
        },
        422: { description: 'Validation failed' },
        500: { description: 'Server error' },
      },
    }

    if (method !== 'get' && method !== 'head' && r.name) {
      // Heuristic: convert route name `posts.store` → action
      // `Actions/PostStoreAction`. Best-effort — silently fall through
      // if no action file matches.
      const guess = r.name
        .split('.')
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join('')
      const actionPath = `Actions/${guess}Action`
      const validations = await loadActionValidations(actionPath)
      if (validations && Object.keys(validations).length > 0) {
        const schema: Record<string, unknown> = { type: 'object', properties: {}, required: [] }
        const props = schema.properties as Record<string, unknown>
        const required = schema.required as string[]
        for (const [field, def] of Object.entries(validations)) {
          const rule = (def as { rule?: unknown })?.rule
          props[field] = ruleToSchema(rule)
          if ((rule as { _required?: boolean })?._required) required.push(field)
        }
        if (required.length === 0) delete schema.required
        op.requestBody = {
          required: required.length > 0,
          content: { 'application/json': { schema } },
        }
      }
    }

    spec.paths[oasPath][method] = op
  }

  // Persist for build pipelines that want the file on disk; in dev,
  // the live route at GET /__openapi.json regenerates on every hit so
  // schema changes don't require a rebuild step.
  const file = Bun.file(path.frameworkPath(`api/openapi.json`))
  const writer = file.writer()
  writer.write(JSON.stringify(spec, null, 2))
  await writer.end()

  return spec
}
