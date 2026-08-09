/**
 * Pure helpers for the auto-CRUD route generator (../routes.ts).
 *
 * Extracted so the write-path key mapping and middleware resolution can be
 * unit-tested without booting the router or a database. The canonical
 * storage/framework/orm/routes.ts entrypoint delegates to ../core/orm/routes,
 * so every runtime consumes these same helpers.
 */

interface UniqueViolation { code?: string, errno?: number, message?: string }

/**
 * True when the error is a unique-constraint violation, across SQLite,
 * MySQL, and Postgres:
 *
 * - SQLite: `SQLITE_CONSTRAINT_UNIQUE` / `SQLITE_CONSTRAINT`
 * - MySQL: `errno: 1062` (ER_DUP_ENTRY)
 * - Postgres: `code: '23505'` (unique_violation)
 * - Generic fallback: message text match — covers wrapped errors from drivers
 *   that lose the structured code.
 *
 * Lives here (cycle-free `@stacksjs/orm`) rather than in `@stacksjs/auth`
 * because every framework write path needs it: auto-CRUD routes, commerce/cms
 * write functions, and `@stacksjs/auth`'s `register()` (which re-exports this
 * via './rbac-store-bqb' for back-compat). `@stacksjs/database` is NOT a valid
 * home — its drivers statically import `@stacksjs/orm`, so orm routes importing
 * from database would create a package cycle.
 *
 * Exported for direct unit testing and for callers that map duplicates to
 * their own error (e.g. `register()`'s 409) instead of swallowing them.
 */
export function isUniqueViolation(err: unknown): boolean {
  const e = err as UniqueViolation
  return e?.code === 'SQLITE_CONSTRAINT_UNIQUE'
    || e?.code === 'SQLITE_CONSTRAINT'
    || e?.code === '23505'
    || e?.errno === 1062
    || /unique|duplicate/i.test(e?.message ?? '')
}

/**
 * Classify a write-path error into an HTTP status + JSON body for the
 * auto-CRUD store/update handlers. Three branches, in priority order:
 *
 * 1. HttpError-like (an Error carrying an integer `status` in 400-599) —
 *    preserve its status, message and optional `details`. Duck-typed rather
 *    than `instanceof HttpError` so this helper stays inline-copyable into the
 *    canonical generated routes file without importing @stacksjs/error-handling.
 *    Covers the 400/413/422 throws from getRequestBody / validation.
 * 2. Unique-constraint violation — 409 with a clean `${Model} already exists`
 *    message (NO raw driver text, which would leak column names in prod).
 * 3. Anything else — the unchanged 500 contract, including `detail: String(err)`.
 */
export function mapWriteError(
  err: unknown,
  modelName: string,
  op: 'create' | 'update',
): { status: number, body: Record<string, unknown> } {
  const e = err as { status?: unknown, message?: unknown, details?: unknown }
  if (
    err instanceof Error
    && typeof e.status === 'number'
    && Number.isInteger(e.status)
    && e.status >= 400
    && e.status < 600
  ) {
    const body: Record<string, unknown> = { error: err.message }
    if (e.details !== undefined) body.details = e.details
    return { status: e.status, body }
  }

  if (isUniqueViolation(err))
    return { status: 409, body: { error: `${modelName} already exists` } }

  return {
    status: 500,
    body: { error: `Failed to ${op} ${modelName}`, detail: String(err) },
  }
}

/**
 * Attribute names in model definitions may be camelCase; the migration
 * drivers (database/src/drivers/{sqlite,mysql,postgres}.ts) snake_case them
 * into column names. Write payload keys must be mapped the same way, LAST on
 * the write path — fillable filtering, validation, set-hooks and casts are
 * all keyed by attribute name. Output-identical to @stacksjs/strings
 * snakeCase for word-shaped attribute names (locked in by tests).
 */
export function toSnakeCase(s: string): string {
  return s.replace(/([a-z\d])([A-Z])/g, '$1_$2').replace(/([A-Z])([A-Z][a-z])/g, '$1_$2').toLowerCase()
}

/** Map every key of a write payload to its snake_case column spelling. */
export function toSnakeCaseKeys(data: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {}
  for (const [k, v] of Object.entries(data)) out[toSnakeCase(k)] = v
  return out
}

/**
 * Resolve the model fields accepted by generated store/update routes.
 *
 * Declared fillable attributes remain the primary allowlist. A `belongsTo`
 * declaration also defines a real foreign-key column in model-driven
 * migrations, so its `<relation>Id` attribute is writable through `useApi`
 * without requiring a bespoke action for every relationship. No undeclared
 * body key is admitted, and hasMany/hasOne relations never contribute keys.
 */
export function getWritableFields(model: {
  attributes?: Record<string, { fillable?: boolean }>
  belongsTo?: unknown[]
} | null | undefined): string[] {
  if (!model) return []

  const fields = Object.entries(model.attributes ?? {})
    .filter(([, attribute]) => attribute?.fillable === true)
    .map(([name]) => name)

  for (const relation of model.belongsTo ?? []) {
    if (typeof relation !== 'string' || !relation.trim())
      continue

    const words = toSnakeCase(relation.trim()).split('_').filter(Boolean)
    if (words.length === 0)
      continue

    const relationField = `${words[0]}${words.slice(1).map(word => `${word[0]?.toUpperCase()}${word.slice(1)}`).join('')}Id`
    fields.push(relationField)
  }

  return [...new Set(fields)]
}

/**
 * Filter a request body down to fillable fields. Accepts BOTH the
 * attribute-name spelling and its snake_case column spelling on input, so
 * read-modify-write round-trips work (GET responses expose snake_case
 * columns). The result stays keyed by attribute name — setters, casts and
 * validation rules all look fields up by that spelling.
 */
export function filterFillable(body: any, fillableFields: string[]): Record<string, any> {
  if (!body || fillableFields.length === 0) return {}
  const result: Record<string, any> = {}
  for (const field of fillableFields) {
    if (field in body) {
      result[field] = body[field]
      continue
    }
    const snake = toSnakeCase(field)
    if (snake !== field && snake in body) result[field] = body[snake]
  }
  return result
}

/**
 * Normalize JSON-safe values for validators whose in-process type cannot be
 * represented directly in a request body. `schema.date()` validates a Date
 * instance, while browser forms submit an ISO calendar date string. Keep the
 * stored write payload unchanged and normalize only the value passed to the
 * validator.
 */
export function normalizeValidationValue(rule: any, value: unknown): unknown {
  if (rule?.name !== 'date' || value instanceof Date || typeof value !== 'string')
    return value

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match)
    return value

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const parsed = new Date(Date.UTC(year, month - 1, day))
  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day
  ) {
    return value
  }

  return parsed
}

/**
 * Drop attribute keys flagged `hidden: true` from an incoming write body.
 * Must drop BOTH spellings — accepting the snake spelling in filterFillable
 * without this would let `payment_intent_id` sneak past a camelCase hidden
 * marker.
 */
export function dropHiddenInputs(data: Record<string, any>, hiddenFields: string[]): Record<string, any> {
  if (!hiddenFields.length) return data
  const out: Record<string, any> = { ...data }
  for (const f of hiddenFields) {
    delete out[f]
    delete out[toSnakeCase(f)]
  }
  return out
}

/**
 * Strip attribute keys flagged `hidden: true` from an outgoing response
 * record. Must drop BOTH spellings — DB rows come back keyed by snake_case
 * column names, so deleting only the attribute-name spelling lets a
 * camelCase hidden attribute (Transaction's `paymentDetails`) leak as
 * `payment_details` on public reads. Response-side mirror of
 * `dropHiddenInputs`.
 */
export function stripHidden(record: any, hiddenFields: string[]): any {
  if (!record || hiddenFields.length === 0) return record
  const result = { ...record }
  for (const field of hiddenFields) {
    delete result[field]
    delete result[toSnakeCase(field)]
  }
  return result
}

/**
 * Columns every auto-CRUD table carries regardless of declared attributes.
 * Members of the read allowlist (sort/filter) alongside the model's own
 * attribute names.
 */
export const SYSTEM_COLUMNS = ['id', 'uuid', 'created_at', 'updated_at', 'deleted_at']

/**
 * Build the read-path column allowlist for a model: a map from BOTH the
 * attribute-name spelling and its snake_case column spelling to the real
 * snake_case column. One map serves `?sort=` and `?<column>=` filters.
 *
 * Why a map and not a set: attribute names may be camelCase
 * (`discountType`) while DB columns are always snake_case (the migration
 * drivers snake_case them — same contract as `toSnakeCaseKeys` on the
 * write path). A set keyed by attribute spelling let `?sort=discountType`
 * through to `orderBy('discountType')` (ghost column → 500) while
 * REJECTING the real column spelling `discount_type`. The map accepts
 * either spelling and always emits the column spelling.
 *
 * Hidden attributes are removed under BOTH spellings — sorting or
 * equality-filtering on a hidden column (`?two_factor_secret=x`) is a
 * blind-enumeration oracle even though the value never appears in the
 * response body.
 */
export function buildReadColumnMap(
  attributes: Record<string, unknown> | null | undefined,
  hiddenFields: string[],
): Map<string, string> {
  const map = new Map<string, string>()
  for (const name of [...Object.keys(attributes ?? {}), ...SYSTEM_COLUMNS]) {
    const column = toSnakeCase(name)
    // bun-query-builder interpolates ORDER BY / WHERE columns raw and
    // unquoted — only word-shaped columns may enter the map.
    if (!/^\w+$/.test(column)) continue
    map.set(name, column)
    map.set(column, column)
  }
  for (const f of hiddenFields) {
    map.delete(f)
    map.delete(toSnakeCase(f))
  }
  return map
}

/**
 * Apply a `?sort=` parameter to a query builder chain. Comma-separated
 * tokens, each optionally `-` prefixed for descending. Tokens are resolved
 * through the `columns` allowlist map (see `buildReadColumnMap`) so either
 * spelling of a declared, non-hidden attribute works and everything else —
 * unknown names, hidden attributes, non-word tokens — is silently skipped
 * (the existing contract, matching the filter loop).
 *
 * Examples:
 *   ?sort=name              → ORDER BY name ASC
 *   ?sort=-rating           → ORDER BY rating DESC
 *   ?sort=discountType,name → ORDER BY discount_type ASC, name ASC
 */
export function applySorting(query: any, sortParam: string | null, columns: ReadonlyMap<string, string>): any {
  if (!sortParam) return query
  const tokens = String(sortParam).split(',').map(t => t.trim()).filter(Boolean)
  let q = query
  for (const tok of tokens) {
    const desc = tok.startsWith('-')
    const requested = desc ? tok.slice(1) : tok
    if (!/^\w+$/.test(requested)) continue
    const column = columns.get(requested)
    if (!column) continue
    q = q.orderBy(column, desc ? 'desc' : 'asc')
  }
  return q
}

/**
 * Built-in cast resolvers — kept in sync with @stacksjs/orm/define-model.
 * A duplicate here is the simplest way to keep auto-CRUD parity with the
 * model-driven path without introducing a circular import.
 */
export const AUTO_CRUD_CASTERS: Record<string, { get: (v: unknown) => unknown, set: (v: unknown) => unknown }> = {
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
function safeJSONOrEmpty(_s: string): unknown { try { return JSON.parse(_s) } catch { return [] } }

/**
 * Apply a model's `casts` to a record, in either direction:
 *   - `'get'`  — DB shape → JS-typed values (read responses)
 *   - `'set'`  — input → DB shape (write payloads)
 *
 * Casts are declared keyed by attribute name (possibly camelCase:
 * `instantBook: 'boolean'`) but DB rows come back keyed by snake_case
 * column names (`instant_book`) — so each cast is applied under BOTH
 * spellings, whichever is present. A record keyed by attribute names
 * (the write path) behaves exactly as before; a snake-keyed DB row (the
 * read path) now gets its casts instead of leaking raw SQLite `"1"`s.
 */
export function applyCasts(
  record: Record<string, any> | null | undefined,
  casts: Record<string, string | { get: (v: unknown) => unknown, set: (v: unknown) => unknown }> | null | undefined,
  direction: 'get' | 'set',
): any {
  if (!record || typeof record !== 'object' || !casts || Object.keys(casts).length === 0) return record
  const out: Record<string, any> = { ...record }
  for (const [attr, castDef] of Object.entries(casts)) {
    const caster = typeof castDef === 'string' ? AUTO_CRUD_CASTERS[castDef] : castDef
    if (!caster || typeof caster[direction] !== 'function') continue
    if (Object.prototype.hasOwnProperty.call(out, attr)) out[attr] = caster[direction](out[attr])
    const snake = toSnakeCase(attr)
    if (snake !== attr && Object.prototype.hasOwnProperty.call(out, snake)) out[snake] = caster[direction](out[snake])
  }
  return out
}

/**
 * Run each declared `validation.rule` against a write payload.
 *
 * Returns `{ valid: true }` or `{ valid: false, errors }`. Per-attribute custom
 * messages from `validation.message` override the rule's default text.
 *
 * Fields the caller never sent are skipped on the `updating` hook, so a partial
 * update does not trip a `required` rule on a sibling field it never touched.
 *
 * Lives here rather than in `../routes.ts` so BOTH write paths can reach it.
 * It used to be a local function in that module, which meant the declared rules
 * ran on the generated REST routes and nowhere else: `Model.create()`,
 * `.update()` and `.save()` went straight to the driver, and an over-length
 * value first got noticed by Postgres as a 22001, surfacing as a 500 on
 * whichever endpoint performed the write (stacksjs/stacks#2233). Importing it
 * from `routes.ts` was not an option — that module registers routes on import.
 */
export type WriteValidationResult =
  | { valid: true }
  | { valid: false, errors: Record<string, string[]> }

export function validateWriteBody(
  data: Record<string, any>,
  model: any,
  hook: 'creating' | 'updating',
): WriteValidationResult {
  const attrs = model?.attributes ?? {}
  const errors: Record<string, string[]> = {}
  for (const [field, def] of Object.entries(attrs as Record<string, any>)) {
    const rule: any = def?.validation?.rule
    if (!rule || typeof rule.validate !== 'function') continue
    const present = Object.prototype.hasOwnProperty.call(data, field)
    if (!present && hook === 'updating') continue

    // An absent field on create is worth `default`, not `undefined`.
    //
    // Enforcement is the outermost write wrapper — deliberately, since the
    // rules are written against pre-cast input — which puts it ahead of every
    // step that fills defaults in. Reading `undefined` here therefore failed
    // `required()` for fields the model had already said it knew a value for,
    // making `required().default(x)` a mandatory field with a dead default.
    // The framework's own `Product.preparationTime` is declared that way, so
    // writing a product from code failed on a field the caller had no opinion
    // about.
    //
    // `hasOwnProperty`, not a truthiness test: `default: 0` and `default: ''`
    // are values, and are exactly the defaults most likely to be declared.
    const hasDefault = def !== null && typeof def === 'object'
      && Object.prototype.hasOwnProperty.call(def, 'default')

    const raw = present
      ? data[field]
      : hasDefault ? (def as { default?: unknown }).default : undefined

    // The default is validated rather than waved through, so a default that
    // breaks its own rule is caught at the first write instead of silently
    // storing an invalid row.
    const value = normalizeValidationValue(rule, raw)
    const result = rule.validate(value)
    if (!result?.valid && Array.isArray(result?.errors) && result.errors.length > 0) {
      errors[field] = result.errors.map((e: any) =>
        def?.validation?.message?.[e?.code] ?? e?.message ?? 'invalid',
      )
    }
  }
  return Object.keys(errors).length === 0 ? { valid: true } : { valid: false, errors }
}

/**
 * A route path with every parameter name flattened to `{}`.
 *
 * The "user routes win" guard compared paths literally, so an app's own
 * `/api/sites/{siteId}` did not suppress the ORM's `/api/sites/{id}` — the two
 * strings differ, so BOTH were registered and the ORM copy carried none of the
 * app's authorization. The app had declared the endpoint and still got a second,
 * unguarded one it never wrote (stacksjs/stacks#2224).
 *
 * The parameter's NAME is the app's business. The shape is what decides whether
 * this URL is already claimed.
 */
export function routeShape(path: string): string {
  // Both spellings the router accepts, so `/sites/:siteId` matches too.
  return path.replace(/\{[^}]*\}/g, '{}').replace(/:[^/]+/g, '{}')
}

/** Drop non-string and empty entries, accepting a bare string as a one-item list. */
function middlewareList(raw: unknown): string[] {
  if (Array.isArray(raw))
    return raw.filter((m: unknown): m is string => typeof m === 'string' && m.length > 0)
  return typeof raw === 'string' && raw ? [raw] : []
}

/**
 * Resolve middleware lists for a model's `useApi` trait value (which may be
 * `true` or `{ uri, routes, middleware }`).
 *
 * Secure-by-default on BOTH sides: with no declared `useApi.middleware`, read
 * and mutating routes alike get `auth`.
 *
 * #1949 gave the mutating routes that default and deliberately left reads
 * public, reasoning that catalog tables (products, posts) want anonymous
 * browsing. The cost of that default landed on models that are not catalogs: a
 * model opting into the trait without declaring middleware published
 * `GET /api/{uri}` and `GET /api/{uri}/{id}` to anyone. In one real app that
 * was `GET /api/users` returning the full customer list — only `password` was
 * `hidden`, so names and emails came back — and the app's own security tests
 * could not see it, because the route was never declared in its route files
 * (stacksjs/stacks#2224).
 *
 * A wrong "public" default is a data breach; a wrong "private" default is a 401
 * on the first request in development. Only one of those is recoverable, so the
 * default is now `auth` and a public read is something an app asks for.
 *
 * Three declaration shapes, so asking is always possible:
 *
 *   `middleware: ['auth']`              both sides get the list (unchanged)
 *   `middleware: []`                    both sides public — deliberate opt-out,
 *                                       warned about at the call site
 *   `middleware: { read, write }`       per-side lists
 *
 * The split form exists because the secure default would otherwise make the
 * most common real shape — public catalog reads, authenticated writes —
 * inexpressible: a flat `middleware: []` is the only way to open reads, and it
 * opens writes at the same time. That is a worse trade than the bug being fixed,
 * so `{ read: [], write: ['auth'] }` says it exactly.
 */
export function resolveApiMiddleware(useApi: unknown): { read: string[], write: string[], declared: boolean } {
  const declared = typeof useApi === 'object' && useApi !== null && 'middleware' in (useApi as Record<string, unknown>)
  const raw = (useApi as any)?.middleware

  if (!declared)
    return { read: ['auth'], write: ['auth'], declared: false }

  // Split form. `read`/`write` are independent: an omitted side falls back to
  // the secure default rather than to "public", so `{ write: ['auth'] }` does
  // not quietly reopen reads.
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const split = raw as Record<string, unknown>
    return {
      read: 'read' in split ? middlewareList(split.read) : ['auth'],
      write: 'write' in split ? middlewareList(split.write) : ['auth'],
      declared: true,
    }
  }

  const list = middlewareList(raw)
  return { read: list, write: list, declared: true }
}

// Default page size for the auto-CRUD index route. Matches the
// request-aware Model.paginate() / resolvePageArgs default (15) so the
// REST list endpoint and the in-process paginator agree out of the box.
export const INDEX_DEFAULT_PER_PAGE = 15
// Upper bound on ?per_page= so a single request can't ask for an
// unbounded page and exhaust memory.
export const INDEX_MAX_PER_PAGE = 100

/**
 * Resolve `?page=` / `?per_page=` for the index route into a clamped,
 * NaN-safe `{ page, perPage, offset }`.
 *
 * - `page` is clamped to `>= 1` (a `?page=0` / negative would otherwise
 *   produce a negative OFFSET), defaulting to 1 on missing/NaN.
 * - `perPage` defaults to {@link INDEX_DEFAULT_PER_PAGE}, is clamped to
 *   `>= 1`, and capped at {@link INDEX_MAX_PER_PAGE}.
 */
export function resolveIndexPageArgs(params: URLSearchParams): { page: number, perPage: number, offset: number } {
  const pageRaw = Number.parseInt(params.get('page') || String(1), 10)
  const page = Number.isFinite(pageRaw) ? Math.max(1, pageRaw) : 1
  const perPageRaw = Number.parseInt(params.get('per_page') || String(INDEX_DEFAULT_PER_PAGE), 10)
  const perPage = Math.min(Number.isFinite(perPageRaw) ? Math.max(1, perPageRaw) : INDEX_DEFAULT_PER_PAGE, INDEX_MAX_PER_PAGE)
  return { page, perPage, offset: (page - 1) * perPage }
}

/**
 * Pagination `meta` for the auto-CRUD index envelope (`{ data, meta }`).
 *
 * Always carries `page` / `per_page` / `from` / `to` / `has_more_pages`
 * plus `prev_page_url` / `next_page_url`. `total` / `last_page` and the
 * `first_page_url` / `last_page_url` are added only when a total is known
 * (`?with_count=true`).
 */
export interface IndexPageMeta {
  page: number
  per_page: number
  from: number | null
  to: number | null
  has_more_pages: boolean
  prev_page_url: string | null
  next_page_url: string | null
  total?: number
  last_page?: number
  first_page_url?: string
  last_page_url?: string
}

// Build a URL string preserving every existing query param on `url`,
// overriding only `page`. Returns `pathname + search` (relative) so the
// caller doesn't leak the host. Standalone (not the request-context-coupled
// buildUrl in paginator-request.ts) because the index route already holds
// `new URL(req.url)` and the canonical routes.ts copy can't import ./src/*.
function pageUrl(url: URL, page: number): string {
  const out = new URL(url.toString())
  out.searchParams.set('page', String(page))
  return `${out.pathname}${out.search}`
}

/**
 * Build the index pagination `meta`. `hasMore` is the source of truth for
 * "is there a next page" (derived by the route from a `LIMIT perPage + 1`
 * probe fetch), so `next_page_url` stays consistent whether or not a total
 * was counted. When `total` is known, `last_page` uses the
 * `Math.max(1, ceil(total / perPage))` floor from the Paginator interface.
 */
export function buildIndexMeta(
  url: URL,
  page: number,
  perPage: number,
  rowCount: number,
  hasMore: boolean,
  total?: number,
): IndexPageMeta {
  const offset = (page - 1) * perPage
  const empty = rowCount === 0
  const meta: IndexPageMeta = {
    page,
    per_page: perPage,
    from: empty ? null : offset + 1,
    to: empty ? null : offset + rowCount,
    has_more_pages: hasMore,
    prev_page_url: page > 1 ? pageUrl(url, page - 1) : null,
    next_page_url: hasMore ? pageUrl(url, page + 1) : null,
  }
  if (total !== undefined && !Number.isNaN(total)) {
    const lastPage = Math.max(1, Math.ceil(total / perPage))
    meta.total = total
    meta.last_page = lastPage
    meta.first_page_url = pageUrl(url, 1)
    meta.last_page_url = pageUrl(url, lastPage)
  }
  return meta
}

/**
 * Flat Laravel paginator shape lifted to the index response top level.
 * Mirrors {@link IndexPageMeta} minus `data`/`path` (the route spreads this
 * alongside its own `data`), but keys the current page as `current_page`
 * instead of `page` so a generated-endpoint list response deep-equals a
 * `Model.paginate()` envelope. `total` / `last_page` / `first_page_url` /
 * `last_page_url` stay gated on `total` (`?with_count=true`), matching
 * {@link SimplePaginator} when absent.
 */
export interface IndexPaginator {
  current_page: number
  per_page: number
  from: number | null
  to: number | null
  has_more_pages: boolean
  prev_page_url: string | null
  next_page_url: string | null
  total?: number
  last_page?: number
  first_page_url?: string
  last_page_url?: string
}

/**
 * Flat Laravel paginator shape for the index response top level. Same values
 * as {@link buildIndexMeta} but keyed `current_page` (not `page`) so a
 * generated-endpoint list response deep-equals a `Model.paginate()` envelope.
 * The `page` -> `current_page` rename is the only delta; the value math lives
 * solely in `buildIndexMeta`.
 */
export function buildIndexPaginator(
  url: URL,
  page: number,
  perPage: number,
  rowCount: number,
  hasMore: boolean,
  total?: number,
): IndexPaginator {
  const { page: currentPage, ...rest } = buildIndexMeta(url, page, perPage, rowCount, hasMore, total)
  return { current_page: currentPage, ...rest }
}
