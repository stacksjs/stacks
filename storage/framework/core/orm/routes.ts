/**
 * ORM-generated routes
 *
 * Auto-generates CRUD REST API routes based on model `useApi` trait definitions.
 * User-defined routes in ./routes/ are loaded first and always take priority.
 */

import type { EnhancedRequest } from '@stacksjs/bun-router'
import { route } from '@stacksjs/router'
import { projectPath } from '@stacksjs/path'
import { setConfig, createQueryBuilder } from '@stacksjs/query-builder'
import { HttpError } from '@stacksjs/error-handling'

// Initialize query builder config from project's config/qb.ts
const qbConfigPath = projectPath('config/qb.ts')
const qbConfig = (await import(qbConfigPath)).default
setConfig(qbConfig)

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

// Helper: strip hidden fields from a record
function stripHidden(record: any, hiddenFields: string[]): any {
  if (!record || hiddenFields.length === 0) return record
  const result = { ...record }
  for (const field of hiddenFields) {
    delete result[field]
  }
  return result
}

// Helper: filter request body to only fillable fields
function filterFillable(body: any, fillableFields: string[]): Record<string, any> {
  if (!body || fillableFields.length === 0) return {}
  const result: Record<string, any> = {}
  for (const field of fillableFields) {
    if (field in body) {
      result[field] = body[field]
    }
  }
  return result
}

// Built-in cast resolvers — kept in sync with @stacksjs/orm/define-model.
// A duplicate here is the simplest way to keep auto-CRUD parity with the
// model-driven path without introducing a circular import.
const AUTO_CRUD_CASTERS: Record<string, { get: (v: unknown) => unknown, set: (v: unknown) => unknown }> = {
  string:   { get: v => v != null ? String(v) : null,                                set: v => v != null ? String(v) : null },
  number:   { get: v => v != null ? Number(v) : null,                                set: v => v != null ? Number(v) : null },
  integer:  { get: v => v != null ? Math.trunc(Number(v)) : null,                    set: v => v != null ? Math.trunc(Number(v)) : null },
  float:    { get: v => v != null ? Number.parseFloat(String(v)) : null,             set: v => v != null ? Number.parseFloat(String(v)) : null },
  boolean:  { get: v => v === 1 || v === '1' || v === true || v === 'true',         set: v => (v === true || v === 1 || v === '1' || v === 'true') ? 1 : 0 },
  json:     { get: v => v == null ? null : (typeof v === 'string' ? safeJSON(v) : v), set: v => v == null ? null : typeof v === 'string' ? v : JSON.stringify(v) },
  datetime: { get: v => v ? new Date(v as string) : null,                            set: v => v instanceof Date ? v.toISOString() : v },
  date:     { get: v => v ? new Date(v as string) : null,                            set: v => v instanceof Date ? (v.toISOString().split('T')[0] as string) : v },
  array:    { get: v => v == null ? [] : Array.isArray(v) ? v : (typeof v === 'string' ? safeJSONOrEmpty(v) : []), set: v => v == null ? null : Array.isArray(v) ? JSON.stringify(v) : v },
}

function safeJSON(s: string): unknown { try { return JSON.parse(s) } catch { return s } }
function safeJSONOrEmpty(s: string): unknown { try { return JSON.parse(s) } catch { return [] } }

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
function applySetCasts(data: Record<string, any>, model: any): Record<string, any> {
  const casts: Record<string, string | { get: any, set: any }> = model?.casts ?? {}
  if (!casts || Object.keys(casts).length === 0 || !data) return data
  const out: Record<string, any> = { ...data }
  for (const [attr, castDef] of Object.entries(casts)) {
    if (Object.prototype.hasOwnProperty.call(out, attr)) {
      const caster = typeof castDef === 'string' ? AUTO_CRUD_CASTERS[castDef] : castDef
      if (caster) out[attr] = caster.set(out[attr])
    }
  }
  return out
}

// Apply read-side casts (DB shape → JS-typed values) so the auto-CRUD
// returns `instant_book: true` instead of the raw SQLite text `"1"`.
function applyReadCasts(row: any, model: any): any {
  const casts: Record<string, string | { get: any, set: any }> = model?.casts ?? {}
  if (!row || typeof row !== 'object' || !casts || Object.keys(casts).length === 0) return row
  const out: Record<string, any> = { ...row }
  for (const [attr, castDef] of Object.entries(casts)) {
    if (Object.prototype.hasOwnProperty.call(out, attr)) {
      const caster = typeof castDef === 'string' ? AUTO_CRUD_CASTERS[castDef] : castDef
      if (caster) out[attr] = caster.get(out[attr])
    }
  }
  return out
}

// Helper: create JSON response
function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// Helper: get request body (uses pre-parsed body from stacks-router middleware, falls back to clone).
// Throws an HttpError on malformed JSON so the route handler can return 400 rather than silently
// treating a corrupted payload as `{}` (which previously surfaced as "No fillable fields" 422s
// and made debugging client bugs impossible).
async function getRequestBody(req: EnhancedRequest): Promise<Record<string, any>> {
  if ((req as any).jsonBody && typeof (req as any).jsonBody === 'object') {
    return (req as any).jsonBody
  }
  if ((req as any).formBody && typeof (req as any).formBody === 'object') {
    return (req as any).formBody
  }
  try {
    const parsed = await req.clone().json()
    return parsed && typeof parsed === 'object' ? parsed : {}
  }
  catch (err) {
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

// Helper: apply sort parameter to a query builder chain
function applySorting(query: any, sortParam: string | null, _table: string): any {
  if (!sortParam) return query
  const desc = sortParam.startsWith('-')
  const column = desc ? sortParam.slice(1) : sortParam
  // Only allow alphanumeric and underscore column names to prevent injection
  if (!/^\w+$/.test(column)) return query
  return query.orderBy(column, desc ? 'desc' : 'asc')
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
async function resolveOwnership(
  model: any,
  user: any,
  req: EnhancedRequest,
): Promise<{ enforced: boolean, value: unknown, field: string, bypass: boolean }> {
  const cfg = model?.ownership
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

  // GET /api/{uri} — list all records (paginated, sortable)
  if (enabledRoutes.includes('index') && !routeExists('GET', basePath)) {
    route.get(basePath, async (req: EnhancedRequest) => {
      try {
        const url = new URL(req.url)
        const page = Number.parseInt(url.searchParams.get('page') || '1', 10)
        const perPage = Math.min(Number.parseInt(url.searchParams.get('per_page') || '25', 10), 100)
        const offset = (page - 1) * perPage
        const sort = url.searchParams.get('sort')

        let query = (db as any).selectFrom(table)
        query = applySorting(query, sort, table)

        // Apply query string filters: ?status=active&name=foo filters by column values.
        // Reserved query params (pagination, sort, etc.) are skipped. Filter keys are
        // validated against the model's declared attribute keys + system columns —
        // an unknown key is ignored rather than emitted as raw SQL (e.g. `WHERE limit = ?`
        // would blow up because `limit` is a SQL keyword).
        const RESERVED = new Set(['page', 'per_page', 'sort', 'fields', 'search', 'include', 'limit', 'offset', 'with_count', 'withTrashed', 'onlyTrashed'])
        const SYSTEM_COLUMNS = new Set(['id', 'uuid', 'created_at', 'updated_at', 'deleted_at'])
        const validColumns = new Set([
          ...Object.keys(model.attributes ?? {}),
          ...SYSTEM_COLUMNS,
        ])
        for (const [key, value] of url.searchParams.entries()) {
          if (RESERVED.has(key) || !value) continue
          if (validColumns.has(key) && /^[a-z_][a-z0-9_]*$/i.test(key)) {
            query = query.where(key, '=', value)
          }
        }

        // Apply search across fillable text fields: ?search=keyword
        const searchTerm = url.searchParams.get('search')
        if (searchTerm && fillableFields.length > 0) {
          const textFields = fillableFields.slice(0, 5) // Limit to first 5 fields for performance
          query = query.where((qb: any) => {
            for (const field of textFields) {
              qb = qb.orWhere(field, 'like', `%${searchTerm}%`)
            }
            return qb
          })
        }

        // Apply field selection: ?fields=id,name,email
        const fieldsParam = url.searchParams.get('fields')
        if (fieldsParam) {
          const selectedFields = fieldsParam.split(',').filter(f => /^[a-z_][a-z0-9_]*$/i.test(f.trim()))
          if (selectedFields.length > 0) {
            query = query.select(selectedFields.map((f: string) => f.trim()))
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

        const results = await query.limit(perPage).offset(offset).get()
        const records = (results || []).map((r: any) => stripHidden(applyReadCasts(r, model), hiddenFields))

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
            const raw = await (db as any).selectFrom(table).count()
            const n = typeof raw === 'number' ? raw : Number(raw?.count ?? raw)
            if (Number.isFinite(n)) total = n
          } catch {
            // count() may not be supported by all query builder versions
          }
        }

        const respHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
        if (total !== undefined && !Number.isNaN(total)) respHeaders['X-Total-Count'] = String(total)

        return new Response(JSON.stringify({
          data: records,
          meta: {
            page,
            per_page: perPage,
            ...(total !== undefined && !Number.isNaN(total) ? { total, last_page: Math.ceil(total / perPage) } : {}),
          },
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
    })
  }

  // GET /api/{uri}/{id} — show single record
  if (enabledRoutes.includes('show') && !routeExists('GET', `${basePath}/{id}`)) {
    route.get(`${basePath}/{id}`, async (req: EnhancedRequest) => {
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

        return jsonResponse({ data: stripHidden(applyReadCasts(result, model), hiddenFields) })
      }
      catch (err) {
        if (err instanceof HttpError) {
          const body: Record<string, unknown> = { error: err.message }
          if (err.details !== undefined) body.details = err.details
          return jsonResponse(body, err.status || 400)
        }
        return jsonResponse({ error: `Failed to fetch ${modelName}`, detail: String(err) }, 500)
      }
    })
  }

  // POST /api/{uri} — create record
  if (enabledRoutes.includes('store') && !routeExists('POST', basePath)) {
    route.post(basePath, async (req: EnhancedRequest) => {
      try {
        const body = await getRequestBody(req)
        const data = filterFillable(body, fillableFields)

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
        const hookedData = await applyDefinedSetters(data, model)
        const writeData = applySetCasts(hookedData, model)

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
        if (err instanceof HttpError) {
          const body: Record<string, unknown> = { error: err.message }
          if (err.details !== undefined) body.details = err.details
          return jsonResponse(body, err.status || 400)
        }
        return jsonResponse({ error: `Failed to create ${modelName}`, detail: String(err) }, 500)
      }
    })
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
        const data = filterFillable(body, fillableFields)

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
          if (rowOwner == null || own.value == null || String(rowOwner) !== String(own.value)) {
            return jsonResponse({ error: `Not your ${modelName}` }, 403)
          }
          // Also defend against the request trying to re-parent ownership.
          if (own.field in data && String(data[own.field]) !== String(own.value)) {
            return jsonResponse({ error: `Cannot reassign ${modelName} ownership` }, 403)
          }
        }

        // Add updated_at timestamp
        if (model.traits?.useTimestamps !== false) {
          data.updated_at = new Date().toISOString()
        }

        // Same hook+cast pass as the create path — and crucially the set-hooks
        // must run too, otherwise `PATCH /api/users/{id}` with a password
        // field would store plaintext.
        const hookedData = await applyDefinedSetters(data, model)
        const writeData = applySetCasts(hookedData, model)

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
        if (err instanceof HttpError) {
          const body: Record<string, unknown> = { error: err.message }
          if (err.details !== undefined) body.details = err.details
          return jsonResponse(body, err.status || 400)
        }
        return jsonResponse({ error: `Failed to update ${modelName}`, detail: String(err) }, 500)
      }
    }

    if (!routeExists('PUT', `${basePath}/{id}`)) {
      route.put(`${basePath}/{id}`, updateHandler)
    }
    if (!routeExists('PATCH', `${basePath}/{id}`)) {
      route.patch(`${basePath}/{id}`, updateHandler)
    }
  }

  // DELETE /api/{uri}/{id} — delete record (or soft-delete if model has useSoftDeletes).
  const usesSoftDeletes = !!model.traits?.useSoftDeletes
  if (enabledRoutes.includes('destroy') && !routeExists('DELETE', `${basePath}/{id}`)) {
    route.delete(`${basePath}/{id}`, async (req: EnhancedRequest) => {
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
          if (rowOwner == null || own.value == null || String(rowOwner) !== String(own.value)) {
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
    })
  }

  // POST /api/{uri}/bulk-delete — delete multiple records (also soft-aware,
  // also ownership-checked per row).
  if (enabledRoutes.includes('destroy') && !routeExists('POST', `${basePath}/bulk-delete`)) {
    route.post(`${basePath}/bulk-delete`, async (req: EnhancedRequest) => {
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
              .filter(r => String(r[own.field]) === String(own.value))
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
    })
  }
}

export default route
