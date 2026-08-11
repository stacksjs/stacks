import { path } from '@stacksjs/path'
import type { SchemaObject } from './generate-types'

interface OpenApiPathItem {
  [method: string]: {
    summary?: string
    operationId?: string
    parameters?: Array<{ name: string, in: string, required: boolean, schema: SchemaObject }>
    responses: Record<string, { description: string, content?: Record<string, { schema?: SchemaObject }> }>
    requestBody?: { content: Record<string, { schema?: SchemaObject }>, required?: boolean }
  }
}

interface OpenApiSpec {
  openapi: string
  info: { title: string, version: string }
  paths: Record<string, OpenApiPathItem>
  components: { schemas: Record<string, SchemaObject> }
}

/**
 * Map a Stacks validation rule to an OpenAPI 3.0 schema fragment.
 *
 * A validator is not formally typed at this boundary, so this reads the shape
 * it actually has: `name` for the type, `rules[]` for the chained constraints
 * and their params, `allowedValues` for an enum, `isRequired` for presence.
 * Best-effort - anything unrecognised falls through as `{ type: 'string' }` so
 * the spec stays valid even when the rule cannot be described precisely.
 */
export function ruleToSchema(rule: unknown): Record<string, unknown> {
  if (!rule || typeof rule !== 'object') return { type: 'string' }
  const r = rule as Record<string, unknown>

  /*
   * Read the validator's own shape: `name`, `rules[]`, `allowedValues`.
   *
   * This used to duck-type `_type` / `_min` / `_email` / `_enum`, none of which
   * the validation library has - so every field in every document came out as
   * `{ type: 'string' }` with no constraints, including the numbers. A document
   * that types everything as a string is worse than one that says nothing: a
   * client generated from it compiles, and then sends `"12"` where the server
   * wanted `12`.
   *
   * The underscore fields are still read as a fallback. If some validator
   * somewhere really does use them, describing it is better than not.
   */
  const rules = Array.isArray(r.rules) ? (r.rules as Array<Record<string, unknown>>) : []
  const named = (name: string) => rules.find(entry => entry.name === name)
  const parameter = (name: string, key: string): number | undefined => {
    const value = (named(name)?.params as Record<string, unknown> | undefined)?.[key]
    return typeof value === 'number' ? value : undefined
  }

  const type = (r.name as string) ?? (r._type as string) ?? 'string'
  const out: Record<string, unknown> = { type: type === 'enum' ? 'string' : type }

  const min = parameter('min', 'min') ?? (typeof r._min === 'number' ? r._min : undefined)
  const max = parameter('max', 'max') ?? (typeof r._max === 'number' ? r._max : undefined)

  // A string's bound is a length and a number's is a value. Emitting
  // `minimum: 3` for a string is not merely unhelpful, it is a constraint a
  // strict validator will try to enforce against text.
  if (min !== undefined) out[type === 'string' ? 'minLength' : 'minimum'] = min
  if (max !== undefined) out[type === 'string' ? 'maxLength' : 'maximum'] = max

  if (named('email') || r._email) out.format = 'email'
  if (named('url') || r._url) out.format = 'uri'
  if (named('uuid') || r._uuid) out.format = 'uuid'

  const allowed = Array.isArray(r.allowedValues) ? r.allowedValues : Array.isArray(r._enum) ? r._enum : null
  if (allowed) out.enum = allowed

  return out
}

/** Whether a rule says the field must be present. */
export function ruleIsRequired(rule: unknown): boolean {
  if (!rule || typeof rule !== 'object') return false
  const r = rule as Record<string, unknown>

  return Boolean(r.isRequired ?? r._required)
}

/**
 * Try to resolve an action's validations object given its handler
 * path string (e.g. 'Actions/CreatePostAction'). Returns `null` on
 * any resolution failure so generation never crashes the spec build.
 */
async function loadActionValidations(handlerPath: string): Promise<Record<string, unknown> | null> {
  /*
   * Any handler that resolves to a file under `app/` or the framework
   * defaults, not only one whose path happens to contain `Actions`.
   *
   * That substring check quietly excluded every action registered from a
   * sibling directory - `'Mcp/McpAction'`, `'Git/ReceivePack'` - which is a
   * layout the override model explicitly supports. `..` is refused because a
   * handler string is data from a route file and this ends in an `import`.
   */
  if (typeof handlerPath !== 'string' || !handlerPath || handlerPath.includes('..')) return null
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
export async function generateOpenApi(options: {
  write?: boolean
  /**
   * Produce the canonical, machine-independent document.
   *
   * The committed `storage/framework/api/openapi.json` is compared byte for
   * byte against a fresh generation, so anything that varies by machine or by
   * run makes the check either fail for everyone or pass for nobody. Portable
   * mode pins those inputs and refuses to emit a document it cannot vouch for.
   *
   * Defaults to true, because every path that produces or verifies the shared
   * artifact must agree. Only the live `GET /__openapi.json` route wants the
   * app-flavoured variant, and it opts out explicitly.
   */
  portable?: boolean
} = {}): Promise<OpenApiSpec> {
  const portable = options.portable ?? true
  const { listRegisteredRoutes } = await import('@stacksjs/router')

  // `buddy generate:openapi` runs as its own one-shot CLI process — unlike
  // the real dev/prod server (see storage/framework/core/server/src/start.ts),
  // nothing has imported routes/api.ts (or the framework defaults, or the
  // useApi-generated ORM routes) yet, so routeMiddlewareRegistry is empty
  // and listRegisteredRoutes() below returns nothing. Load routes the same
  // way the server does, just without actually calling serve(). Best-effort
  // and idempotent-safe: if this ever runs inside an already-booted process
  // (routes already loaded), re-importing is a silent no-op per each
  // module's own import-cache semantics, not a duplicate-registration error.
  try {
    const { loadRoutes } = await import('@stacksjs/router')
    // Resolved through `path`, not by counting `../` up from this file. Five
    // levels lands on the project root only in the vendored layout; a core-less
    // app - the default `buddy new` produces - resolves this package out of
    // node_modules, where the same five levels land somewhere unrelated. The
    // import then failed, no routes registered, and the generator refused to
    // emit a spec for an app whose `routes/` directory was right there.
    const { default: routeRegistry } = await import(path.appPath('Routes.ts'))
    await loadRoutes(routeRegistry)
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    // Warning and carrying on means a broken route registry silently yields a
    // SMALLER spec, and a smaller spec is indistinguishable from "routes were
    // deleted" in review. Refuse when the document is meant to be canonical.
    if (portable)
      throw new Error(`[generateOpenApi] Refusing to emit a partial spec: failed to load routes/api.ts + framework routes: ${message}`)
    console.warn(`[generateOpenApi] Failed to load routes/api.ts + framework routes: ${message}`)
  }
  try {
    // Package first, relative second. Each resolves in exactly one layout: the
    // specifier is the only form an installed app can follow (a spec generated
    // there used to silently omit every model's CRUD endpoints), and the
    // relative path is the only form that works on a clean checkout of THIS
    // repository, where `@stacksjs/orm`'s dist has not been built yet.
    // The specifier is held in a variable on purpose. Bun resolves a LITERAL
    // one while transpiling the module, so an unresolvable literal takes this
    // whole file down before any `try` around the await can run — which is how
    // a clean checkout (no built dist behind `@stacksjs/orm/routes`) produced a
    // spec missing far more than the ORM routes. Through a variable it is a
    // runtime resolution, and a runtime failure is catchable.
    const ormRoutesPackage = '@stacksjs/orm/routes'
    try {
      await import(ormRoutesPackage)
    }
    catch {
      await import('../../orm/routes')
    }
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (portable)
      throw new Error(`[generateOpenApi] Refusing to emit a partial spec: failed to load useApi-generated ORM routes: ${message}`)
    console.warn(`[generateOpenApi] Failed to load useApi-generated ORM routes: ${message}`)
  }

  // Convert `:id` to OpenAPI `{id}` up front, because that converted string is
  // what becomes a `spec.paths` key and therefore what has to be sorted. The
  // two orderings genuinely differ: `/api/queries/:id` sorts BEFORE
  // `/api/queries/dashboard` (`:` is 0x3A) while `/api/queries/{id}` sorts
  // AFTER it (`{` is 0x7B).
  const toOasPath = (p: string): string => p.replace(/(^|\/):(\w+)(?=$|\/)/g, '$1{$2}')

  // Sort before anything reads the list. Route registration order follows
  // import order, so without this the operationId collision suffixes below
  // (`_get`, `_get_2`) attach to whichever duplicate happened to register
  // first, and `spec.paths` serializes in that same incidental order. Two
  // machines then produce different bytes from identical sources.
  //
  // Plain comparison, not localeCompare: collation is locale-dependent, which
  // is exactly the class of variation this exists to remove.
  const routes = [...listRegisteredRoutes()]
    .map(route => ({ route, oasPath: toOasPath(route.path), method: route.method.toLowerCase() }))
    .sort((a, b) => {
      if (a.oasPath !== b.oasPath) return a.oasPath < b.oasPath ? -1 : 1
      return a.method < b.method ? -1 : a.method > b.method ? 1 : 0
    })

  if (portable && routes.length === 0) {
    throw new Error(
      '[generateOpenApi] Refusing to emit an empty spec: no routes were registered. '
      + 'This usually means route loading failed silently rather than that the app has no API.',
    )
  }

  // The live route reports the app's own name (config/app.ts `name`, which is
  // `env.APP_NAME ?? 'Stacks'`), because a developer pointing SwaggerUI at
  // their dev server wants to see their app.
  //
  // The canonical artifact must NOT: APP_NAME is per-machine and per-.env, so
  // whoever regenerated last would stamp their environment into a tracked file
  // and every other contributor's check would then disagree.
  let appName = 'Stacks API'
  if (!portable) {
    try {
      const { config } = await import('@stacksjs/config')
      if (config.app?.name) appName = `${config.app.name} API`
    }
    catch { /* best-effort — keep the generic fallback */ }
  }

  const spec: OpenApiSpec = {
    openapi: '3.0.0',
    info: { title: appName, version: '1.0.0' },
    paths: {},
    components: { schemas: {} },
  }

  const operationIds = new Set<string>()
  for (const { route: r, oasPath, method } of routes) {
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
    const preferredOperationId = r.name ?? `${method}_${oasPath.replace(/[^a-z0-9]/gi, '_')}`
    let operationId = preferredOperationId
    if (operationIds.has(operationId)) {
      operationId = `${preferredOperationId}_${method}`
      let suffix = 2
      while (operationIds.has(operationId)) operationId = `${preferredOperationId}_${method}_${suffix++}`
    }
    operationIds.add(operationId)
    const op: OpenApiPathItem[string] = {
      summary: r.name ?? r.path,
      operationId,
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

    /*
     * The action, from the handler the route was registered with.
     *
     * This used to title-case the route *name* into a guessed file path
     * (`posts.store` → `Actions/PostsStoreAction`), which meant an input schema
     * appeared only for routes that both carried a name and happened to follow
     * that convention. Every other endpoint was documented as accepting
     * nothing - not "unknown", *nothing* - and a client generated from the
     * document therefore took no arguments and could not call them.
     *
     * `handler` is the string the route was actually registered with, so this
     * is a lookup rather than a guess. An inline function handler has no file
     * to read, and reports nothing, which is honest.
     */
    const validations = r.handler ? await loadActionValidations(r.handler) : null

    if (validations && Object.keys(validations).length > 0) {
      const fields = Object.entries(validations).map(([field, def]) => {
        const rule = (def as { rule?: unknown })?.rule
        return { field, schema: ruleToSchema(rule), required: ruleIsRequired(rule) }
      })

      if (method === 'get' || method === 'head' || method === 'delete') {
        /*
         * Query parameters, not a body.
         *
         * A GET with a body is a request most intermediaries drop silently, so
         * a document that describes one produces a client that appears to work
         * locally and loses its arguments behind the first proxy. DELETE goes
         * the same way for the same reason.
         *
         * Path parameters are already in the list and win: a field that
         * appears in both is the same value, and declaring it twice makes the
         * document invalid.
         */
        const taken = new Set(paramNames)
        for (const { field, schema, required } of fields) {
          if (taken.has(field)) continue
          op.parameters?.push({ name: field, in: 'query', required, schema: schema as SchemaObject })
        }
      }
      else {
        const schema: Record<string, unknown> = { type: 'object', properties: {}, required: [] }
        const props = schema.properties as Record<string, unknown>
        const required = schema.required as string[]
        for (const field of fields) {
          props[field.field] = field.schema
          if (field.required) required.push(field.field)
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

  if (options.write !== false) {
    // Persist for build pipelines that want the file on disk; in dev,
    // the live route at GET /__openapi.json regenerates on every hit so
    // schema changes don't require a rebuild step.
    const file = Bun.file(path.frameworkPath(`api/openapi.json`))
    const writer = file.writer()
    writer.write(JSON.stringify(spec, null, 2))
    await writer.end()

    /*
     * The types and the client, from the same document, in the same step.
     *
     * Emitting them from a separate command is how they drift: the document
     * gets regenerated by whoever added a route, the client does not, and the
     * mismatch surfaces as a client that cannot call an endpoint that plainly
     * exists. One command means there is no version of "regenerated" that
     * leaves them disagreeing.
     */
    const { renderOpenApiTypes } = await import('./generate-types')
    const { renderApiClient } = await import('./generate-client')

    await Bun.write(path.frameworkPath('api/api-types.ts'), renderOpenApiTypes(spec))
    await Bun.write(path.frameworkPath('api/client.ts'), renderApiClient(spec, { name: spec.info.title }))
  }

  return spec
}
