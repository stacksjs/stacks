/**
 * Pure helpers for the auto-CRUD route generator (../routes.ts).
 *
 * Extracted so the write-path key mapping and middleware resolution can be
 * unit-tested without booting the router or a database. The canonical
 * generated routes file (storage/framework/orm/routes.ts) inlines copies of
 * these — it must stay importable when @stacksjs/orm is npm-installed — so
 * any behavioral change here must be mirrored there.
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
 * Resolve middleware lists for a model's `useApi` trait value (which may be
 * `true` or `{ uri, routes, middleware }`).
 *
 * Secure-by-default: mutating routes (store/update/destroy) get `auth`
 * unless the model explicitly declares `useApi.middleware` — an explicit
 * `middleware: []` is a deliberate opt-out and is honored (with a startup
 * warning at the call site). Read routes stay public unless declared.
 */
export function resolveApiMiddleware(useApi: unknown): { read: string[], write: string[], declared: boolean } {
  const declared = typeof useApi === 'object' && useApi !== null && 'middleware' in (useApi as Record<string, unknown>)
  const raw = (useApi as any)?.middleware
  const list: string[] = Array.isArray(raw)
    ? raw.filter((m: unknown) => typeof m === 'string' && m.length > 0)
    : (typeof raw === 'string' && raw ? [raw] : [])
  return { read: list, write: declared ? list : ['auth'], declared }
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
