/**
 * ORM-generated routes
 *
 * Auto-generates CRUD REST API routes based on model `useApi` trait definitions.
 * User-defined routes in ./routes/ are loaded first and always take priority.
 */

import type { EnhancedRequest } from '@stacksjs/bun-router'
import { route } from '@stacksjs/router'
import { env } from '@stacksjs/env'
import { projectPath } from '@stacksjs/path'
import { createQueryBuilder, defaultConfig, setConfig } from '@stacksjs/query-builder'
import { HttpError } from '@stacksjs/error-handling'
import { log } from '@stacksjs/logging'
import { applyCasts, applySorting, buildIndexMeta, buildIndexPaginator, buildReadColumnMap, dropHiddenInputs, filterFillable, mapWriteError, resolveApiMiddleware, resolveIndexPageArgs, stripHidden, toSnakeCase, toSnakeCaseKeys } from './src/auto-crud'

// Initialize the query builder config from the project's optional
// `config/qb.ts` override (stacksjs/stacks#1930).
//
// This file is NOT scaffolded by the framework — it's a per-project
// escape hatch. On a fresh clone / clean container build it's absent,
// and a hard `await import(...)` here used to throw `Cannot find
// module config/qb.ts` and abort the entire ORM-route bootstrap (so
// every model-backed Action 404'd in production while `buddy dev`
// masked it against stale local state).
//
// The fallback used to be bun-query-builder's own `defaultConfig`, whose
// doc comment claims it's "env-driven" but is actually a hardcoded
// `dialect: 'postgres'` literal — every project running the framework's
// own zero-config SQLite default (any fresh `buddy new`, since no
// config/qb.ts is ever scaffolded) got every useApi-generated REST route
// silently pointed at Postgres, failing with "role \"postgres\" does not
// exist" the moment anything hit GET /api/{resource}. Derive the fallback
// from the same DB_CONNECTION / DB_DATABASE_PATH env vars every other
// data-layer entry point (migrations, the ORM itself) already reads,
// instead of a package-level default that has never matched this
// framework's own default database.
const qbConfigPath = projectPath('config/qb.ts')
try {
  const projectQbConfig = (await import(qbConfigPath)).default
  setConfig(projectQbConfig ?? defaultConfig)
}
catch {
  log.debug(`[orm] No config/qb.ts override found — deriving config from DB_CONNECTION`)
  const dialect = (env.DB_CONNECTION as 'sqlite' | 'mysql' | 'postgres' | undefined) || 'sqlite'
  setConfig({
    ...defaultConfig,
    dialect,
    database: dialect === 'sqlite'
      ? { database: env.DB_DATABASE_PATH || 'database/stacks.sqlite' }
      : {
          database: env.DB_DATABASE || 'stacks',
          host: env.DB_HOST || '127.0.0.1',
          port: env.DB_PORT || (dialect === 'postgres' ? 5432 : 3306),
          username: env.DB_USERNAME || (dialect === 'postgres' ? 'postgres' : 'root'),
          password: env.DB_PASSWORD || '',
        },
  } as Parameters<typeof setConfig>[0])
}

// Load all models from app/Models/ (individually, so one broken model doesn't block the rest)
const modelsDir = projectPath('app/Models')
const models: Record<string, any> = {}

try {
  const { readdirSync, statSync } = await import('node:fs')
  const { extname, basename } = await import('node:path')

  const entries = readdirSync(modelsDir)
  for (const entry of entries) {
    const full = `${modelsDir}/${entry}`
    const st = statSync(full)
    if (st.isDirectory()) continue
    const ext = extname(full)
    if (!['.ts', '.js'].includes(ext)) continue

    try {
      const mod = await import(`${full}?t=${Date.now()}`)
      const def = mod.default ?? mod
      const name = def.name ?? basename(entry, ext)
      models[name] = { ...def, name }
    }
    catch {
      // Skip models that fail to import (e.g., missing dependencies)
    }
  }
}
catch {
  // Models directory may not exist yet
}

// Create a query builder instance (uses the config set above)
const db = createQueryBuilder()

// Helper: check if a route is already registered (user-defined routes take priority)
function routeExists(method: string, path: string): boolean {
  return route.routes.some(
    (r: any) => r.method === method && r.path === path,
  )
}

// Helper: get fillable attribute names from a model
function getFillableFields(model: any): string[] {
  if (!model.attributes) return []
  return Object.entries(model.attributes)
    .filter(([_, attr]: [string, any]) => attr.fillable === true)
    .map(([name]: [string, any]) => name)
}

// Helper: get hidden attribute names from a model
function getHiddenFields(model: any): string[] {
  if (!model.attributes) return []
  return Object.entries(model.attributes)
    .filter(([_, attr]: [string, any]) => attr.hidden === true)
    .map(([name]: [string, any]) => name)
}

// Run each declared `validation.rule` against an incoming write payload.
// Returns { valid: true } or { valid: false, errors }. Per-attribute custom
// messages from `validation.message` override the rule's default text.
//
// Skips fields the caller never sent on PATCH requests so a partial update
// doesn't trip a "required" rule on a sibling field that wasn't touched.
// eslint-disable-next-line pickier/no-unused-vars
function validateWriteBody(
  _data: Record<string, any>,
  _model: any,
  _hook: 'creating' | 'updating',
): { valid: true } | { valid: false, errors: Record<string, string[]> } {
  const data = _data
  const model = _model
  const hook = _hook
  const attrs = model?.attributes ?? {}
  const errors: Record<string, string[]> = {}
  for (const [field, def] of Object.entries(attrs as Record<string, any>)) {
    const rule: any = def?.validation?.rule
    if (!rule || typeof rule.validate !== 'function') continue
    const present = Object.prototype.hasOwnProperty.call(data, field)
    if (!present && hook === 'updating') continue
    const value = present ? data[field] : undefined
    const result = rule.validate(value)
    if (!result?.valid && Array.isArray(result?.errors) && result.errors.length > 0) {
      errors[field] = result.errors.map((e: any) =>
        def?.validation?.message?.[e?.code] ?? e?.message ?? 'invalid',
      )
    }
  }
  return Object.keys(errors).length === 0 ? { valid: true } : { valid: false, errors }
}

// Naive English pluralization for hasMany relation names. Matches
// bun-query-builder's table-name convention (User → users, CarPhoto →
// car_photos). Edge cases (mouse → mice, child → children) are not
// covered — models that need them should override `useApi.uri`.
function pluralize(s: string): string {
  if (s.endsWith('y') && !/[aeiou]y$/i.test(s)) return `${s.slice(0, -1)}ies`
  if (/(?:s|x|z|ch|sh)$/i.test(s)) return `${s}es`
  return `${s}s`
}

/**
 * Eager-load `belongsTo` + `hasMany` relations declared on a model and
 * attach them under snake_case keys on each row. Hidden fields are
 * recursively stripped from every loaded relation so a `?include=user`
 * on a Booking can never leak the user's password hash even if a future
 * model marks it fillable.
 *
 * Limited to one level of depth — `?include=user.host_profile` would
 * need a recursive walker that's beyond the scope of the v1 implementation.
 */
async function applyIncludes(
  rows: any[],
  model: any,
  includeParam: string,
  modelsRegistry: Record<string, any>,
): Promise<any[]> {
  if (!rows.length) return rows
  const requested = includeParam.split(',').map(s => s.trim()).filter(Boolean)
  if (!requested.length) return rows

  const belongsTo: string[] = Array.isArray(model.belongsTo) ? model.belongsTo : []
  const hasMany: string[] = Array.isArray(model.hasMany) ? model.hasMany : []
  const hasOne: string[] = Array.isArray(model.hasOne) ? model.hasOne : []

  // Build a lookup: snake_case include key → { kind, modelName }
  const allowed = new Map<string, { kind: 'belongsTo' | 'hasOne' | 'hasMany', modelName: string }>()
  for (const m of belongsTo) allowed.set(toSnakeCase(m), { kind: 'belongsTo', modelName: m })
  for (const m of hasOne) allowed.set(toSnakeCase(m), { kind: 'hasOne', modelName: m })
  for (const m of hasMany) allowed.set(pluralize(toSnakeCase(m)), { kind: 'hasMany', modelName: m })

  for (const include of requested) {
    const meta = allowed.get(include)
    if (!meta) continue // silently drop unknown includes — same shape as filter handling
    const related = modelsRegistry[meta.modelName]
    if (!related) continue
    const relatedTable = related.table || pluralize(toSnakeCase(meta.modelName))
    const relatedHidden = getHiddenFields(related)
    const relatedAttrs = (id: any) => stripHidden(applyReadCasts(id, related), relatedHidden)

    if (meta.kind === 'belongsTo' || meta.kind === 'hasOne') {
      const fkOnParent = `${toSnakeCase(meta.modelName)}_id`
      const ids = [...new Set(rows.map(r => r[fkOnParent]).filter(v => v != null))]
      if (!ids.length) {
        for (const r of rows) r[include] = null
        continue
      }
      const childRows = await (db as any).selectFrom(relatedTable).whereIn('id', ids).get()
      const byId = new Map<string, any>()
      for (const cr of childRows ?? []) byId.set(String(cr.id), relatedAttrs(cr))
      for (const r of rows) r[include] = byId.get(String(r[fkOnParent])) ?? null
    }
    else {
      // hasMany: child rows have parent_id pointing back at us.
      const parentName = String(model.name ?? '')
      const fkOnChild = `${toSnakeCase(parentName)}_id`
      const parentIds = [...new Set(rows.map(r => r.id).filter(v => v != null))]
      if (!parentIds.length) {
        for (const r of rows) r[include] = []
        continue
      }
      const childRows = await (db as any).selectFrom(relatedTable).whereIn(fkOnChild, parentIds).get()
      const grouped = new Map<string, any[]>()
      for (const cr of childRows ?? []) {
        const key = String(cr[fkOnChild])
        const arr = grouped.get(key) ?? []
        arr.push(relatedAttrs(cr))
        grouped.set(key, arr)
      }
      for (const r of rows) r[include] = grouped.get(String(r.id)) ?? []
    }
  }
  return rows
}

// Apply user-defined `set:` hooks (e.g. User.set.password = bcrypt) before
// raw DB writes so the auto-CRUD store/update endpoints don't end up storing
// plaintext where the model declared a transformation. Mirrors the helper
// in @stacksjs/orm/define-model — duplicated here to avoid a circular
// import. Errors from individual setters are swallowed (logged in
// define-model's version) so a single broken setter can't kill the whole
// payload.
async function applyDefinedSetters(data: Record<string, any>, model: any): Promise<Record<string, any>> {
  const setters: Record<string, (attrs: Record<string, unknown>) => unknown> | undefined = model?.set
  if (!setters || typeof setters !== 'object') return data
  const out: Record<string, any> = { ...data }
  for (const [key, fn] of Object.entries(setters)) {
    if (typeof fn !== 'function' || !(key in out)) continue
    try {
      out[key] = await fn(out)
    }
    catch { /* surfaced via define-model's logger */ }
  }
  return out
}

// Apply set-side casts (input → DB shape) so PATCH /api/cars/{id} with
// `{ instant_book: true }` writes `1`, matching what model.create() does.
// applyCasts handles BOTH key spellings (attribute name + snake column).
function applySetCasts(data: Record<string, any>, model: any): Record<string, any> {
  return applyCasts(data, model?.casts, 'set')
}

// Apply read-side casts (DB shape → JS-typed values) so the auto-CRUD
// returns `instant_book: true` instead of the raw SQLite text `"1"`.
// DB rows come back keyed by snake_case columns while casts are declared
// by attribute name — applyCasts matches either spelling.
function applyReadCasts(row: any, model: any): any {
  return applyCasts(row, model?.casts, 'get')
}

// Helper: create JSON response
function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// Same as jsonResponse but stamps `request_id` into the body for error
// envelopes. Pairs with the X-Request-ID response header so SPAs + RUM
// tooling can correlate a user-facing error to a specific log line
// without relying on header capture.
function errorResponse(req: any, body: Record<string, any>, status = 400): Response {
  const reqId = req?._requestId
  const enriched = reqId ? { ...body, request_id: reqId } : body
  return new Response(JSON.stringify(enriched), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// Helper: get request body (uses pre-parsed body from stacks-router middleware, falls back to clone).
// Throws an HttpError on malformed JSON so the route handler can return 400 rather than silently
// treating a corrupted payload as `{}` (which previously surfaced as "No fillable fields" 422s
// and made debugging client bugs impossible).
// Cap any single request body at this many bytes. 1 MB is generous for
// JSON CRUD payloads (a 6-photo car listing is ~5 KB) but tight enough
// that a hostile client can't park a 50 MB body and tie up the parser.
// File uploads have their own multipart pipeline upstream and don't
// route through this helper.
const MAX_BODY_BYTES = 1_048_576

async function getRequestBody(req: EnhancedRequest): Promise<Record<string, any>> {
  // Body-size check runs FIRST so even pre-parsed bodies (jsonBody attached
  // by upstream middleware) can't slip past the cap. We trust the
  // advertised content-length header here — clients that lie about it
  // get caught when the actual text is read below.
  const contentLength = Number(req.headers?.get?.('content-length') ?? 0)
  if (contentLength > MAX_BODY_BYTES)
    throw new HttpError(413, `Request body exceeds ${MAX_BODY_BYTES}-byte limit`)

  if ((req as any).jsonBody && typeof (req as any).jsonBody === 'object') {
    return (req as any).jsonBody
  }
  if ((req as any).formBody && typeof (req as any).formBody === 'object') {
    return (req as any).formBody
  }

  try {
    const text = await req.clone().text()
    if (text.length > MAX_BODY_BYTES)
      throw new HttpError(413, `Request body exceeds ${MAX_BODY_BYTES}-byte limit`)
    if (!text) return {}
    const parsed = JSON.parse(text)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  }
  catch (err) {
    if (err instanceof HttpError) throw err
    throw new HttpError(400, `Invalid JSON body: ${(err as Error).message}`)
  }
}

// Helper: coerce a primary-key-shaped value submitted by a client (bulk-delete IDs,
// path params, etc.) into a number when the column looks numeric, or pass through
// when it's a non-empty string (UUID, slug). Anything else becomes null and the
// caller should reject with 422.
function coerceId(raw: unknown): number | string | null {
  if (raw == null) return null
  if (typeof raw === 'number') return Number.isFinite(raw) && raw > 0 ? raw : null
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed) return null
    if (/^\d+$/.test(trimmed)) {
      const n = Number(trimmed)
      return Number.isFinite(n) && n > 0 ? n : null
    }
    return trimmed
  }
  return null
}

// Helper: extract bearer token from a request, falling back to the raw header
// when the enhanced request hasn't attached a `bearerToken()` method.
function bearerOf(req: EnhancedRequest): string | null {
  const fn = (req as any).bearerToken
  if (typeof fn === 'function') {
    const t = fn.call(req)
    if (t) return t
  }
  const auth = req.headers?.get?.('authorization') || req.headers?.get?.('Authorization') || ''
  if (typeof auth === 'string' && auth.startsWith('Bearer '))
    return auth.substring(7)
  return null
}

// Helper: resolve the authed user via the @stacksjs/auth façade — used by the
// `authedFill` model option to derive ownership-stamping fields like
// `host_profile_id` from the requesting user. Returns null when unauthed.
async function authedUserFromRequest(req: EnhancedRequest): Promise<any | null> {
  const stored = (req as any)._authenticatedUser
  if (stored) return stored
  const token = bearerOf(req)
  if (!token) return null
  try {
    const { Auth } = await import('@stacksjs/auth')
    const user = await (Auth as any).getUserFromToken(token)
    if (user) (req as any)._authenticatedUser = user
    return user || null
  }
  catch {
    return null
  }
}

// Helper: resolve the authed user's "owner identity" for a given model so
// the auto-CRUD update/destroy/bulk-destroy paths can compare it against
// the row's `field`.
//
// `ownership` model config shape:
//   ownership: {
//     field: 'host_profile_id',           // column on this row
//     resolve: async (user) => number?,   // what value of `field` does
//                                         // the authed user own?
//     bypass?: (user) => boolean,         // optional admin escape hatch
//   }
//
// Returns the resolved owner value, or `null` if the model has no
// ownership config (caller should treat as "no per-row check").
// Helper: do row's ownership field value belong to the resolved owner?
// Supports both scalar (single owner id) and array (set of allowed ids,
// useful for two-hop ownership where a Photo's car_id must be ∈ the
// authed host's owned car ids).
function ownsRow(rowField: unknown, ownerValue: unknown): boolean {
  if (rowField == null || ownerValue == null) return false
  if (Array.isArray(ownerValue))
    return ownerValue.some(v => String(v) === String(rowField))
  return String(rowField) === String(ownerValue)
}

// Does this model carry a direct `team_id` column? Declared attributes are
// keyed by attribute name (camelCase `teamId`) but the DB column is
// snake_case `team_id` — accept either spelling, always return the column.
function teamColumnOf(model: any): string | null {
  const attrs = model?.attributes || {}
  const has = (k: string) => Object.prototype.hasOwnProperty.call(attrs, k)
  return (has('teamId') || has('team_id')) ? 'team_id' : null
}

// Adapt a raw EnhancedRequest to the `{ bearerToken, cookies }` shape
// @stacksjs/auth's team resolver expects. The handler can't rely on
// `req.bearerToken()` being wired here (the auto-CRUD paths read the
// Authorization header directly via bearerOf), so surface the credential
// from the header and parse the Cookie header for the session/token cookie.
function teamAuthRequest(req: EnhancedRequest): { bearerToken: () => string | null, cookies: { get: (name: string) => string | null } } {
  const token = bearerOf(req)
  const cookieHeader = (req.headers?.get?.('cookie') as string | null) || ''
  return {
    bearerToken: () => token,
    cookies: {
      get: (name: string) => {
        for (const part of cookieHeader.split(';')) {
          const eq = part.indexOf('=')
          if (eq === -1) continue
          if (part.slice(0, eq).trim() === name)
            return decodeURIComponent(part.slice(eq + 1).trim())
        }
        return null
      },
    },
  }
}

// The ownership config actually enforced for a model. An explicit
// `model.ownership` always wins. Otherwise any model with a `team_id`
// column is auto-scoped to the caller's active team — tenant tables are
// row-isolated with zero per-model config, while a public catalog table
// (no team_id, no ownership) resolves to `null` and stays un-scoped.
//
// The team is resolved from the request's REAL credential (bearer token or
// session cookie) via @stacksjs/auth — never from a client-supplied field —
// so a caller can't widen their own scope by POSTing or ?team_id=-ing another
// team's id. Lazy import mirrors authedUserFromRequest: avoids a boot-time
// cycle through @stacksjs/auth.
function effectiveOwnershipConfig(model: any): any | null {
  if (model?.ownership) return model.ownership
  const teamCol = teamColumnOf(model)
  if (!teamCol) return null
  return {
    field: teamCol,
    resolve: async (_user: any, req: EnhancedRequest) => {
      const { resolveAuthenticatedTeamId } = await import('@stacksjs/auth')
      return resolveAuthenticatedTeamId(teamAuthRequest(req) as any)
    },
  }
}

async function resolveOwnership(
  model: any,
  user: any,
  req: EnhancedRequest,
): Promise<{ enforced: boolean, value: unknown, field: string, bypass: boolean }> {
  const cfg = effectiveOwnershipConfig(model)
  if (!cfg || !cfg.field || typeof cfg.resolve !== 'function')
    return { enforced: false, value: null, field: '', bypass: false }
  const bypass = typeof cfg.bypass === 'function' ? !!cfg.bypass(user, req) : false
  let value: unknown = null
  try {
    value = await cfg.resolve(user, req)
  }
  catch { value = null }
  return { enforced: true, value, field: String(cfg.field), bypass }
}

// Helper: apply a model's `authedFill` config for the given lifecycle hook.
// Returns a partial object to merge into the insert/update payload.
async function resolveAuthedFill(
  model: any,
  hook: 'creating' | 'updating',
  user: any,
  req: EnhancedRequest,
): Promise<Record<string, any>> {
  const cfg = model?.authedFill?.[hook]
  if (!cfg) return {}
  if (typeof cfg === 'function') {
    try {
      const result = await cfg(user, req)
      return result && typeof result === 'object' ? result : {}
    }
    catch {
      return {}
    }
  }
  if (typeof cfg === 'object') {
    const out: Record<string, any> = {}
    for (const [field, getter] of Object.entries(cfg)) {
      try {
        out[field] = typeof getter === 'function' ? await (getter as any)(user, req) : getter
      }
      catch { /* ignore individual getter errors */ }
    }
    return out
  }
  return {}
}

// Register CRUD routes for each model with useApi trait
for (const [modelName, model] of Object.entries(models)) {
  const useApi = model.traits?.useApi
  if (!useApi) continue

  // useApi can be `true` (auto-derive uri from table) or an object with { uri, routes }
  const apiConfig = typeof useApi === 'object' ? useApi : {}
  const uri = apiConfig.uri || model.table || modelName.toLowerCase() + 's'

  const enabledRoutes: string[] = apiConfig.routes || ['index', 'show', 'store', 'update', 'destroy']
  const table = model.table || uri
  const fillableFields = getFillableFields(model)
  const hiddenFields = getHiddenFields(model)
  const basePath = `/api/${uri}`

  // Read-path column allowlist: declared model attributes + system columns,
  // minus anything marked `hidden`, mapped from EITHER spelling (attribute
  // name or snake_case column) to the real snake_case column. Computed once
  // per model and shared by `?sort=` and the `?<column>=` filter loop so
  // neither can target a ghost column (camelCase attribute → 500) nor
  // enumerate sensitive/hidden columns.
  const readColumns = buildReadColumnMap(model.attributes, hiddenFields)

  // Per-model middleware, honoring the `useApi.middleware` field declared
  // on the model trait (e.g. `middleware: ['auth']` for resources that
  // should never be browsed anonymously). Read routes (index/show) stay
  // public by default — fine for catalog tables (products, posts). Mutating
  // routes (store/update/destroy) are secure-by-default: they get `auth`
  // unless the model explicitly declares `middleware` (an explicit `[]` is
  // a deliberate opt-out), because `enabledRoutes` defaults to all five and
  // a bare `useApi: true` used to expose anonymous POST/PUT/PATCH/DELETE.
  const { read: readMiddleware0, write: writeMiddleware, declared } = resolveApiMiddleware(useApi)
  const hasMutating = ['store', 'update', 'destroy'].some(r => enabledRoutes.includes(r))
  if (hasMutating && declared && writeMiddleware.length === 0)
    log.warn(`[orm] ${modelName}: registering UNAUTHENTICATED mutating routes at ${basePath} (explicit \`middleware: []\` opt-out)`)

  // Row-scoped resource? (explicit `ownership`, or a model with a team_id
  // column that's auto-team-scoped). If so its index/show handlers below
  // restrict every row to the caller's team — which requires knowing who is
  // calling, so force `auth` onto the read routes even though catalog tables
  // (no team_id, no ownership) stay anonymously browsable. Computed once and
  // reused by the handlers to gate the (DB-hitting) ownership resolution.
  const rowScoped = !!effectiveOwnershipConfig(model)
  const readMiddleware = (rowScoped && !readMiddleware0.includes('auth'))
    ? ['auth', ...readMiddleware0]
    : readMiddleware0

  // Local helper: chain `.middleware()` for every entry in `names`.
  // The chainable return value from `route.get/post/...` accepts one
  // name per call, so we fold the list into successive calls.
  const applyMiddleware = (chain: any, names: string[] = readMiddleware): any => {
    let r = chain
    for (const name of names) {
      if (r && typeof r.middleware === 'function') r = r.middleware(name)
    }
    return r
  }

  // GET /api/{uri} — list all records (paginated, sortable)
  if (enabledRoutes.includes('index') && !routeExists('GET', basePath)) {
    applyMiddleware(route.get(basePath, async (req: EnhancedRequest) => {
      try {
        const url = new URL(req.url)
        // Clamped, NaN-safe page/perPage (page >= 1, perPage in [1, 100],
        // default perPage 15 to match Model.paginate() / resolvePageArgs).
        const { page, perPage, offset } = resolveIndexPageArgs(url.searchParams)
        const sort = url.searchParams.get('sort')

        let query = (db as any).selectFrom(table)
        query = applySorting(query, sort, readColumns)

        // Apply query string filters: ?status=active&name=foo filters by column values.
        // Reserved query params (pagination, sort, etc.) are skipped. Filter keys are
        // resolved through the readColumns allowlist (either spelling of a declared,
        // non-hidden attribute → snake_case column) — an unknown key is ignored rather
        // than emitted as raw SQL (e.g. `WHERE limit = ?` would blow up because `limit`
        // is a SQL keyword), and hidden columns can't be equality-probed.
        const RESERVED = new Set(['page', 'per_page', 'sort', 'fields', 'search', 'include', 'limit', 'offset', 'with_count', 'withTrashed', 'onlyTrashed'])
        for (const [key, value] of url.searchParams.entries()) {
          if (RESERVED.has(key) || !value) continue
          if (!/^[a-z_][a-z0-9_]*$/i.test(key)) continue
          const col = readColumns.get(key)
          if (col) {
            query = query.where(col, '=', value)
          }
        }

        // Apply search across fillable text fields: ?search=keyword.
        // Fillable names are attribute spellings — map to the snake_case
        // column so a camelCase fillable doesn't hit a ghost column.
        const searchTerm = url.searchParams.get('search')
        if (searchTerm && fillableFields.length > 0) {
          const textFields = fillableFields.slice(0, 5) // Limit to first 5 fields for performance
          query = query.where((qb: any) => {
            for (const field of textFields) {
              qb = qb.orWhere(toSnakeCase(field), 'like', `%${searchTerm}%`)
            }
            return qb
          })
        }

        // Apply field selection: ?fields=id,name,email. Tokens are mapped
        // through toSnakeCase so attribute spellings select the real column;
        // no allowlist here — undeclared-but-real columns (FK `user_id`)
        // stay selectable, and hidden fields are stripped post-query anyway.
        const fieldsParam = url.searchParams.get('fields')
        if (fieldsParam) {
          const selectedFields = fieldsParam.split(',')
            .map(f => f.trim())
            .filter(f => /^[a-z_][a-z0-9_]*$/i.test(f))
            .map(f => toSnakeCase(f))
          if (selectedFields.length > 0) {
            query = query.select(selectedFields)
          }
        }

        // Soft-delete filtering. By default the index hides deleted_at IS NOT NULL
        // rows; ?withTrashed=true includes them, ?onlyTrashed=true returns only
        // them (admin/audit views). Skip silently if the trait isn't enabled.
        const usesSoftDeletes = !!model.traits?.useSoftDeletes
        const withTrashed = url.searchParams.get('withTrashed') === 'true'
        const onlyTrashed = url.searchParams.get('onlyTrashed') === 'true'
        if (usesSoftDeletes && !withTrashed) {
          query = onlyTrashed ? query.whereNotNull('deleted_at') : query.whereNull('deleted_at')
        }

        // Row-level ownership scoping. For owned/team tables, restrict the
        // listing to rows the caller owns — applied AFTER the ?<col>= filter
        // loop so a `?team_id=<other>` probe can only narrow, never widen,
        // the caller's own scope. Public tables (rowScoped === false) skip
        // this entirely and pay no auth-resolution cost.
        const own = rowScoped
          ? await resolveOwnership(model, await authedUserFromRequest(req), req)
          : { enforced: false, value: null as unknown, field: '', bypass: false }
        if (own.enforced && !own.bypass) {
          if (own.value == null || (Array.isArray(own.value) && own.value.length === 0)) {
            // Authed but owns nothing (e.g. no active team membership) — an
            // empty page, never another tenant's rows. `private, no-store`
            // so a shared cache can't hand this to a different caller.
            const emptyPaginator = buildIndexPaginator(url, page, perPage, 0, false, undefined)
            return new Response(JSON.stringify({
              data: [],
              ...emptyPaginator,
              meta: buildIndexMeta(url, page, perPage, 0, false, undefined),
            }), { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store', Vary: 'Authorization' } })
          }
          query = Array.isArray(own.value)
            ? query.where(own.field, 'in', own.value)
            : query.where(own.field, '=', own.value)
        }

        // Simple-paginate probe: fetch one extra row so `has_more_pages`
        // is known without a COUNT. Slice the probe row off BEFORE casts /
        // includes so applyIncludes doesn't fire N+1 relation queries for a
        // row that's about to be discarded.
        const rawResults = (await query.limit(perPage + 1).offset(offset).get()) || []
        const hasMore = rawResults.length > perPage
        const pageRows = hasMore ? rawResults.slice(0, perPage) : rawResults
        let records = pageRows.map((r: any) => stripHidden(applyReadCasts(r, model), hiddenFields))

        const includeParam = url.searchParams.get('include')
        if (includeParam)
          records = await applyIncludes(records, model, includeParam, models)

        // Total count is opt-in via ?with_count=true. Skipping it by default
        // turns the index from "two queries every request" into "one", which
        // is a meaningful win on big tables — the SPA usually paginates by
        // "load more" anyway and doesn't need a precise total.
        const wantCount = url.searchParams.get('with_count') === 'true'
        let total: number | undefined
        if (wantCount) {
          try {
            // bun-query-builder's count() resolves to a number directly —
            // not to a builder you call executeTakeFirst() on. The previous
            // shape silently swallowed a TypeError in this try/catch and
            // total stayed `undefined`, defeating the whole opt-in.
            //
            // Scope the count to the caller's rows too — an unscoped COUNT
            // would leak the cross-tenant total even though the page data is
            // team-filtered.
            let countQuery = (db as any).selectFrom(table)
            if (own.enforced && !own.bypass && own.value != null) {
              countQuery = Array.isArray(own.value)
                ? countQuery.where(own.field, 'in', own.value)
                : countQuery.where(own.field, '=', own.value)
            }
            const raw = await countQuery.count()
            const n = typeof raw === 'number' ? raw : Number(raw?.count ?? raw)
            if (Number.isFinite(n)) total = n
          } catch {
            // count() may not be supported by all query builder versions
          }
        }

        const respHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
        if (total !== undefined && !Number.isNaN(total)) respHeaders['X-Total-Count'] = String(total)
        // Modest caching for unauthenticated browse — list views change
        // less frequently than detail views and SPAs naturally re-hit them
        // on navigation. Authed lists (which include user-specific filter
        // results) carry a `Vary: Authorization` so caches don't merge
        // them with the public response. Team-scoped listings are per-caller
        // and must NEVER land in a shared cache, so they go `private, no-store`.
        respHeaders['Cache-Control'] = (own.enforced && !own.bypass)
          ? 'private, no-store'
          : 'public, max-age=15, must-revalidate'
        respHeaders.Vary = 'Authorization'

        const paginator = buildIndexPaginator(url, page, perPage, records.length, hasMore, total)
        return new Response(JSON.stringify({
          data: records,
          ...paginator,
          // DEPRECATED: `meta` is kept for one transition release for backward
          // compat. Read the top-level fields instead (note: meta.page ===
          // current_page). Removed in a future release. (#1960)
          meta: buildIndexMeta(url, page, perPage, records.length, hasMore, total),
        }), { status: 200, headers: respHeaders })
      }
      catch (err) {
        if (err instanceof HttpError) {
          const body: Record<string, unknown> = { error: err.message }
          if (err.details !== undefined) body.details = err.details
          return jsonResponse(body, err.status || 400)
        }
        return jsonResponse({ error: `Failed to fetch ${uri}`, detail: String(err) }, 500)
      }
    }))
  }

  // GET /api/{uri}/{id} — show single record
  if (enabledRoutes.includes('show') && !routeExists('GET', `${basePath}/{id}`)) {
    applyMiddleware(route.get(`${basePath}/{id}`, async (req: EnhancedRequest) => {
      try {
        const id = coerceId((req as any).params?.id)

        // Validate ID parameter — coerceId returns null for negatives,
        // empty strings, NaN, etc., so this single check catches them all.
        if (id == null) {
          return jsonResponse({ error: 'Invalid ID parameter' }, 400)
        }

        const result = await (db as any).selectFrom(table).where({ id }).executeTakeFirst()

        if (!result) {
          return jsonResponse({ error: `${modelName} not found` }, 404)
        }

        // Mirror the soft-delete filter from the index handler — without
        // this, GET /api/cars/123 would happily return a row that was
        // soft-deleted, even though it doesn't appear in the listing.
        const url = new URL(req.url)
        if (model.traits?.useSoftDeletes && (result as any).deleted_at && url.searchParams.get('withTrashed') !== 'true') {
          return jsonResponse({ error: `${modelName} not found` }, 404)
        }

        // Row-level ownership enforcement for owned/team tables. A row that
        // belongs to another tenant is reported as 404 (not 403) so this
        // endpoint can't be used to probe which ids exist in other teams.
        const own = rowScoped
          ? await resolveOwnership(model, await authedUserFromRequest(req), req)
          : { enforced: false, value: null as unknown, field: '', bypass: false }
        if (own.enforced && !own.bypass) {
          if (own.value == null || !ownsRow((result as Record<string, unknown>)[own.field], own.value)) {
            return jsonResponse({ error: `${modelName} not found` }, 404)
          }
        }

        let payload: any = stripHidden(applyReadCasts(result, model), hiddenFields)

        // ?include=user,host_profile,car_photos hydrates declared relations.
        // Hidden fields are recursively stripped from each loaded relation.
        const includeParam = url.searchParams.get('include')
        if (includeParam) {
          const [withRel] = await applyIncludes([payload], model, includeParam, models)
          payload = withRel
        }

        // ETag derived from updated_at (or created_at) lets SPAs send
        // If-None-Match and short-circuit re-renders. The 304 response is
        // empty per spec — the client keeps its cached copy. Skip when the
        // request is authed because per-user variants would poison shared
        // caches.
        const lastWrite = (payload as any)?.updated_at || (payload as any)?.created_at
        const etag = lastWrite ? `W/"${(payload as any).id}-${String(lastWrite)}"` : undefined
        const ifNoneMatch = req.headers?.get?.('if-none-match')
        if (etag && ifNoneMatch && ifNoneMatch === etag) {
          return new Response(null, { status: 304, headers: { ETag: etag } })
        }

        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (etag) headers.ETag = etag
        // Public caches default to a short TTL — long enough for SPA list/detail
        // hops to share, short enough that a stale row clears within a minute.
        // Team-scoped rows are per-caller and must never be shared-cached.
        headers['Cache-Control'] = (own.enforced && !own.bypass)
          ? 'private, no-store'
          : 'public, max-age=30, must-revalidate'
        headers.Vary = 'Authorization'
        return new Response(JSON.stringify({ data: payload }), { status: 200, headers })
      }
      catch (err) {
        if (err instanceof HttpError) {
          const body: Record<string, unknown> = { error: err.message }
          if (err.details !== undefined) body.details = err.details
          return jsonResponse(body, err.status || 400)
        }
        return jsonResponse({ error: `Failed to fetch ${modelName}`, detail: String(err) }, 500)
      }
    }))
  }

  // POST /api/{uri} — create record
  if (enabledRoutes.includes('store') && !routeExists('POST', basePath)) {
    applyMiddleware(route.post(basePath, async (req: EnhancedRequest) => {
      try {
        const body = await getRequestBody(req)
        // Belt-and-suspenders: drop hidden inputs FIRST so a curious client
        // can't sneak `payment_intent_id` etc. into a POST even if a future
        // change accidentally flips them to fillable.
        const safeBody = dropHiddenInputs(body, hiddenFields)
        const data = filterFillable(safeBody, fillableFields)

        // Stamp ownership / context-aware fields from the authed user before
        // the body fillable check, so models can declare e.g.
        //   authedFill: { creating: { host_profile_id: async (u) => ... } }
        // and never have to ship a custom Store action just to attach FKs.
        const authedUser = await authedUserFromRequest(req)
        if (authedUser) {
          const stamped = await resolveAuthedFill(model, 'creating', authedUser, req)
          for (const [k, v] of Object.entries(stamped)) {
            if (v !== undefined && v !== null && data[k] === undefined)
              data[k] = v
          }
        }

        if (Object.keys(data).length === 0) {
          return jsonResponse({ error: 'No fillable fields provided' }, 422)
        }

        // Run declared validation rules. Models declare `validation: { rule:
        // schema.string().required().email() }` per attribute — without this
        // call, those declarations were dead documentation.
        const v = validateWriteBody(data, model, 'creating')
        if (!v.valid) return jsonResponse({ error: 'Validation failed', errors: v.errors }, 422)

        // Add timestamps if model uses them
        if (model.traits?.useTimestamps !== false) {
          const now = new Date().toISOString()
          data.created_at = now
          data.updated_at = now
        }

        // 1) User-defined `set:` hooks first (e.g. User.set.password = bcrypt)
        //    so plaintext inputs never reach the DB on POST /api/users.
        // 2) Then the cast pass so booleans/JSON/dates are coerced to the
        //    column shape (mirror of model.create() write path).
        // 3) LAST, map attribute-name keys to their snake_case column
        //    spellings — migration drivers snake_case attribute names into
        //    columns, so a camelCase fillable like `discountType` would
        //    otherwise target a nonexistent column and 500 the INSERT.
        const hookedData = await applyDefinedSetters(data, model)
        const writeData = toSnakeCaseKeys(applySetCasts(hookedData, model))

        const result = await (db as any).insertInto(table).values(writeData).execute()

        // Try to return the full record with database-assigned ID
        let created = writeData
        try {
          const lastId = result?.lastInsertRowid ?? result?.insertId ?? result
          if (lastId) {
            const fetched = await (db as any).selectFrom(table).where({ id: lastId }).executeTakeFirst()
            if (fetched) created = fetched
          }
        } catch {
          // Fall back to returning the input data
        }

        return jsonResponse({ data: stripHidden(applyReadCasts(created, model), hiddenFields) }, 201)
      }
      catch (err) {
        // Maps HttpError-likes through, unique violations -> 409 (clean
        // message, no driver text leak), everything else -> 500. See #1957.
        const { status, body } = mapWriteError(err, modelName, 'create')
        return jsonResponse(body, status)
      }
    }), writeMiddleware)
  }

  // PUT/PATCH /api/{uri}/{id} — update record
  if (enabledRoutes.includes('update')) {
    const updateHandler = async (req: EnhancedRequest) => {
      try {
        const id = coerceId((req as any).params?.id)
        if (id == null) {
          return jsonResponse({ error: 'Invalid ID parameter' }, 400)
        }
        const body = await getRequestBody(req)
        const safeBody = dropHiddenInputs(body, hiddenFields)
        const data = filterFillable(safeBody, fillableFields)

        // Apply authedFill.updating stamps (mirror of the Store path).
        const authedUser = await authedUserFromRequest(req)
        if (authedUser) {
          const stamped = await resolveAuthedFill(model, 'updating', authedUser, req)
          for (const [k, v] of Object.entries(stamped)) {
            if (v !== undefined && v !== null && data[k] === undefined)
              data[k] = v
          }
        }

        if (Object.keys(data).length === 0) {
          return jsonResponse({ error: 'No fillable fields provided' }, 422)
        }

        // Run declared validation rules. Partial updates only validate fields
        // the caller actually sent — see validateWriteBody for the rule.
        const v = validateWriteBody(data, model, 'updating')
        if (!v.valid) return jsonResponse({ error: 'Validation failed', errors: v.errors }, 422)

        // 404 fast if the row doesn't exist — previously the UPDATE silently
        // matched zero rows and we returned the request body as if it had
        // succeeded, which masked legit "deleted between read and write" bugs.
        const existing = await (db as any).selectFrom(table).where({ id }).executeTakeFirst()
        if (!existing) {
          return jsonResponse({ error: `${modelName} not found` }, 404)
        }

        // Ownership check: when the model declares `ownership`, only the row's
        // owner (or an admin via `bypass`) can update it. Without this, any
        // authed user could PATCH /api/cars/{id} and re-parent another host's
        // car to themselves. `authedFill.updating` ALSO can't defend on its
        // own because it only fills missing fields, not replaces submitted ones.
        const own = await resolveOwnership(model, authedUser, req)
        if (own.enforced && !own.bypass) {
          if (!authedUser) return jsonResponse({ error: 'Auth required' }, 401)
          const rowOwner = (existing as Record<string, unknown>)[own.field]
          if (!ownsRow(rowOwner, own.value)) {
            return jsonResponse({ error: `Not your ${modelName}` }, 403)
          }
          // Also defend against the request trying to re-parent ownership.
          // Payload keys are attribute names (possibly camelCase) — compare
          // via the snake_case column spelling so `hostProfileId` can't
          // sneak past a `host_profile_id` ownership field.
          const submittedOwnerKey = Object.keys(data).find(k => toSnakeCase(k) === toSnakeCase(own.field))
          if (submittedOwnerKey !== undefined && !ownsRow(data[submittedOwnerKey], own.value)) {
            return jsonResponse({ error: `Cannot reassign ${modelName} ownership` }, 403)
          }
        }

        // Add updated_at timestamp
        if (model.traits?.useTimestamps !== false) {
          data.updated_at = new Date().toISOString()
        }

        // Same hook+cast pass as the create path — and crucially the set-hooks
        // must run too, otherwise `PATCH /api/users/{id}` with a password
        // field would store plaintext. Key mapping runs LAST (see store path).
        const hookedData = await applyDefinedSetters(data, model)
        const writeData = toSnakeCaseKeys(applySetCasts(hookedData, model))

        await (db as any).updateTable(table).set(writeData).where({ id }).execute()

        // Return the full updated record
        let updated: any = { ...existing, ...writeData }
        try {
          const fetched = await (db as any).selectFrom(table).where({ id }).executeTakeFirst()
          if (fetched) updated = fetched
        } catch {
          // Fall back to merging known existing + diff
        }

        return jsonResponse({ data: stripHidden(applyReadCasts(updated, model), hiddenFields) })
      }
      catch (err) {
        // See store handler — same classification, 'update' verb. #1957.
        const { status, body } = mapWriteError(err, modelName, 'update')
        return jsonResponse(body, status)
      }
    }

    if (!routeExists('PUT', `${basePath}/{id}`)) {
      applyMiddleware(route.put(`${basePath}/{id}`, updateHandler), writeMiddleware)
    }
    if (!routeExists('PATCH', `${basePath}/{id}`)) {
      applyMiddleware(route.patch(`${basePath}/{id}`, updateHandler), writeMiddleware)
    }
  }

  // DELETE /api/{uri}/{id} — delete record (or soft-delete if model has useSoftDeletes).
  const usesSoftDeletes = !!model.traits?.useSoftDeletes
  if (enabledRoutes.includes('destroy') && !routeExists('DELETE', `${basePath}/{id}`)) {
    applyMiddleware(route.delete(`${basePath}/{id}`, async (req: EnhancedRequest) => {
      try {
        const id = coerceId((req as any).params?.id)
        if (id == null) {
          return jsonResponse({ error: 'Invalid ID parameter' }, 400)
        }

        // Need the row both for the 404 fast-path and the ownership check.
        const existing = await (db as any).selectFrom(table).where({ id }).executeTakeFirst()
        if (!existing) {
          return jsonResponse({ error: `${modelName} not found` }, 404)
        }

        const authedUser = await authedUserFromRequest(req)
        const own = await resolveOwnership(model, authedUser, req)
        if (own.enforced && !own.bypass) {
          if (!authedUser) return jsonResponse({ error: 'Auth required' }, 401)
          const rowOwner = (existing as Record<string, unknown>)[own.field]
          if (!ownsRow(rowOwner, own.value)) {
            return jsonResponse({ error: `Not your ${modelName}` }, 403)
          }
        }

        if (usesSoftDeletes) {
          // Soft delete: stamp deleted_at + updated_at instead of dropping the row.
          // Reads in the index handler filter `WHERE deleted_at IS NULL` unless
          // the caller passes ?withTrashed=true.
          const now = new Date().toISOString()
          await (db as any).updateTable(table)
            .set({ deleted_at: now, updated_at: now })
            .where({ id })
            .execute()
        }
        else {
          await (db as any).deleteFrom(table).where({ id }).execute()
        }

        return new Response(null, { status: 204 })
      }
      catch (err) {
        if (err instanceof HttpError) {
          const body: Record<string, unknown> = { error: err.message }
          if (err.details !== undefined) body.details = err.details
          return jsonResponse(body, err.status || 400)
        }
        return jsonResponse({ error: `Failed to delete ${modelName}`, detail: String(err) }, 500)
      }
    }), writeMiddleware)
  }

  // POST /api/{uri}/bulk-delete — delete multiple records (also soft-aware,
  // also ownership-checked per row).
  if (enabledRoutes.includes('destroy') && !routeExists('POST', `${basePath}/bulk-delete`)) {
    applyMiddleware(route.post(`${basePath}/bulk-delete`, async (req: EnhancedRequest) => {
      try {
        const body = await getRequestBody(req)
        const ids = body?.ids

        if (!Array.isArray(ids) || ids.length === 0) {
          return jsonResponse({ error: 'An array of IDs is required' }, 422)
        }

        // Limit bulk operations to 100 records
        if (ids.length > 100) {
          return jsonResponse({ error: 'Cannot delete more than 100 records at once' }, 422)
        }

        // Coerce + validate each ID before opening any transactions.
        // A single bad ID inside a 100-element batch previously fell through
        // to a SQL syntax error after partial deletes had already committed.
        const validIds: Array<number | string> = []
        const invalidIds: unknown[] = []
        for (const raw of ids) {
          const coerced = coerceId(raw)
          if (coerced != null) validIds.push(coerced)
          else invalidIds.push(raw)
        }
        if (invalidIds.length > 0) {
          return jsonResponse({ error: 'Invalid IDs in batch', invalid: invalidIds }, 422)
        }

        const authedUser = await authedUserFromRequest(req)
        const own = await resolveOwnership(model, authedUser, req)

        // For ownership-enforced models, refuse the whole batch if any row
        // isn't owned by the caller. Partial deletes are worse than nothing.
        if (own.enforced && !own.bypass) {
          if (!authedUser) return jsonResponse({ error: 'Auth required' }, 401)
          if (own.value == null) return jsonResponse({ error: 'Caller has no ownership identity' }, 403)
          const rows = await (db as any).selectFrom(table).select(['id', own.field]).execute()
          const ownedIds = new Set(
            (rows as Array<Record<string, unknown>>)
              .filter(r => ownsRow(r[own.field], own.value))
              .map(r => String(r.id)),
          )
          const notOwned = validIds.filter(id => !ownedIds.has(String(id)))
          if (notOwned.length > 0)
            return jsonResponse({ error: `Cannot delete ${modelName} you don't own`, ids: notOwned }, 403)
        }

        const now = new Date().toISOString()
        for (const id of validIds) {
          if (usesSoftDeletes) {
            await (db as any).updateTable(table)
              .set({ deleted_at: now, updated_at: now })
              .where({ id })
              .execute()
          }
          else {
            await (db as any).deleteFrom(table).where({ id }).execute()
          }
        }

        return jsonResponse({ message: `Successfully deleted ${validIds.length} ${uri}` })
      }
      catch (err) {
        if (err instanceof HttpError) {
          const body: Record<string, unknown> = { error: err.message }
          if (err.details !== undefined) body.details = err.details
          return jsonResponse(body, err.status || 400)
        }
        return jsonResponse({ error: `Failed to bulk delete ${uri}`, detail: String(err) }, 500)
      }
    }), writeMiddleware)
  }
}

export default route
