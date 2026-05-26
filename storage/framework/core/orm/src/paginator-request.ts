/**
 * Request-aware pagination helpers (stacksjs/stacks#1906, P2 from #1910).
 *
 * `Model.paginate()` should "just work" inside an action — reading
 * `?page=N&per_page=M` from the active request without callers parsing
 * query strings by hand. This module is the bridge: it lazy-loads the
 * router's request-context AsyncLocalStorage and pulls page / per_page /
 * path off the active `EnhancedRequest`.
 *
 * Lazy-loaded so the orm module doesn't pull `@stacksjs/router` into its
 * dep graph (it isn't a runtime dependency — the orm runs in CLI scripts,
 * queue workers, and migrations where no router is in scope). Both
 * helpers return safe defaults when no request is active.
 */

import type {
  CursorPaginator,
  Paginator,
  SimplePaginator,
} from './paginator'

/**
 * Cap `per_page` to this value when the user supplies a larger one via
 * the query string — guards against `?per_page=1000000` DoS. Apps that
 * need a larger window pass it explicitly as the second positional arg
 * to `.paginate()` (which bypasses the clamp).
 */
const DEFAULT_MAX_PER_PAGE = 100

/** Laravel default. */
const DEFAULT_PER_PAGE = 15

/**
 * Resolved pagination args ready to pass to bqb's `paginate(perPage, page)`.
 */
export interface ResolvedPageArgs {
  perPage: number
  page: number
}

/**
 * Resolve `[perPage, page]` for `Model.paginate(...)`. Precedence:
 *
 *   1. Explicit positional arg from the caller (`Model.paginate(20, 3)`).
 *   2. `?per_page=` / `?page=` from the active request (auto-magic).
 *   3. Defaults: `perPage = 15`, `page = 1`.
 *
 * `perPage` from the query string is clamped to `[1, DEFAULT_MAX_PER_PAGE]`.
 * Explicit positional `perPage` is trusted as-is (the caller is the app,
 * not an untrusted client).
 *
 * `page` is clamped to `>= 1` from both sources to avoid `OFFSET -X`-style
 * negatives reaching the driver.
 */
export function resolvePageArgs(perPageArg?: number, pageArg?: number): ResolvedPageArgs {
  const request = lazyGetCurrentRequest()
  const queryPerPage = request ? readNumericQuery(request, 'per_page') : undefined
  const queryPage = request ? readNumericQuery(request, 'page') : undefined

  // perPage: explicit > query > default. Clamp the query-sourced value
  // (untrusted) but trust the explicit value.
  const perPage = perPageArg !== undefined
    ? Math.max(1, Math.floor(perPageArg))
    : Math.min(DEFAULT_MAX_PER_PAGE, Math.max(1, queryPerPage ?? DEFAULT_PER_PAGE))

  // page: explicit > query > default. Both sources clamped >= 1.
  const page = Math.max(1, Math.floor(pageArg ?? queryPage ?? 1))

  return { perPage, page }
}

/**
 * Resolve cursor args for `Model.cursorPaginate(...)`. Precedence
 * mirrors {@link resolvePageArgs} — explicit > `?cursor=` > null.
 *
 * Cursor values that arrive via the query string (always strings) are
 * fed through {@link parseCursor} so a composite cursor encoded as
 * `JSON.stringify([val1, val2])` reaches bqb as a real array — bqb's
 * `sql(cursor)` interpolation expects an array when the `column` arg
 * is an array (composite-key pagination). Without this parse, the
 * cursor round-trip breaks: serialize → string → wire → string →
 * bqb thinks it's a primitive → wrong query.
 */
export function resolveCursorArgs(
  perPageArg?: number,
  cursorArg?: string | number | unknown[] | null,
): { perPage: number, cursor: unknown } {
  const request = lazyGetCurrentRequest()
  const queryCursor = request ? readStringQuery(request, 'cursor') : undefined
  const queryPerPage = request ? readNumericQuery(request, 'per_page') : undefined

  const perPage = perPageArg !== undefined
    ? Math.max(1, Math.floor(perPageArg))
    : Math.min(DEFAULT_MAX_PER_PAGE, Math.max(1, queryPerPage ?? DEFAULT_PER_PAGE))

  // Explicit > query > null. Both sources go through parseCursor so the
  // app code can pass either the wire format (string) or the native form
  // (array / primitive) without thinking about it.
  const rawCursor = cursorArg !== undefined ? cursorArg : (queryCursor ?? null)
  const cursor = parseCursor(rawCursor)

  return { perPage, cursor }
}

/**
 * Parse a cursor value into the shape bqb's `cursorPaginate` expects.
 *
 *   - `null` / `undefined` → `null` (first page, no WHERE clause)
 *   - Already an array → returned as-is (composite cursor, native form)
 *   - String starting with `[` → JSON-parsed back into an array
 *     (composite cursor that was serialized for the wire format)
 *   - All other strings / primitives → returned as-is (single-column
 *     cursor)
 *
 * This is the missing piece in the wire-format round-trip:
 * {@link toCursorPaginator} encodes composite cursors with
 * `JSON.stringify` so they survive a URL query param round-trip, and
 * this function decodes them on the way back in.
 */
export function parseCursor(value: string | number | unknown[] | null | undefined): unknown {
  if (value === null || value === undefined) return null
  if (Array.isArray(value)) return value
  if (typeof value === 'string' && value.startsWith('[')) {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) return parsed
    }
    catch {
      // Not valid JSON — fall through and treat as a plain string cursor.
    }
  }
  return value
}

/**
 * Fill in `path`, `prev_page_url`, `next_page_url` (and `first_page_url`
 * / `last_page_url` for the full {@link Paginator}) from the active
 * request URL. Mutates the paginator in place and returns it for chaining.
 *
 * No-op when no request is in scope — keeps CLI / queue / cron callers
 * unaffected. Preserves all OTHER query params on the request so search
 * filters survive across page navigations (`?status=active&page=2` →
 * `next_page_url` includes `status=active`).
 */
export function enrichPaginatorUrls<T>(paginator: Paginator<T>): Paginator<T>
export function enrichPaginatorUrls<T>(paginator: SimplePaginator<T>): SimplePaginator<T>
export function enrichPaginatorUrls<T>(paginator: CursorPaginator<T>): CursorPaginator<T>
export function enrichPaginatorUrls(paginator: any): any {
  const request = lazyGetCurrentRequest()
  if (!request) return paginator

  const url = (() => {
    try { return new URL((request as any).url) }
    catch { return null }
  })()
  if (!url) return paginator

  const path = url.pathname
  paginator.path = path

  // Cursor paginator: only prev / next URLs (no page numbers, no first / last).
  if ('next_cursor' in paginator) {
    paginator.next_page_url = paginator.next_cursor !== null
      ? buildUrl(url, { cursor: paginator.next_cursor })
      : null
    paginator.prev_page_url = paginator.prev_cursor !== null
      ? buildUrl(url, { cursor: paginator.prev_cursor })
      : null
    return paginator
  }

  // Offset paginator (both full and simple share these slots).
  const currentPage = paginator.current_page as number
  paginator.prev_page_url = currentPage > 1
    ? buildUrl(url, { page: currentPage - 1 })
    : null

  if ('total' in paginator) {
    // Full paginator — has last_page, can build all four URLs.
    const lastPage = paginator.last_page as number
    paginator.next_page_url = currentPage < lastPage
      ? buildUrl(url, { page: currentPage + 1 })
      : null
    paginator.first_page_url = buildUrl(url, { page: 1 })
    paginator.last_page_url = buildUrl(url, { page: lastPage })
  }
  else {
    // Simple paginator — only know hasMore, so only next_page_url.
    paginator.next_page_url = paginator.has_more_pages
      ? buildUrl(url, { page: currentPage + 1 })
      : null
  }

  return paginator
}

/**
 * Build a URL preserving every existing query param on `base` and
 * overwriting (or appending) the params in `overrides`. Used by
 * {@link enrichPaginatorUrls} to keep search filters intact when
 * generating prev/next links.
 */
function buildUrl(base: URL, overrides: Record<string, string | number>): string {
  const out = new URL(base.toString())
  for (const [key, value] of Object.entries(overrides))
    out.searchParams.set(key, String(value))
  return `${out.pathname}${out.search}`
}

/**
 * Lazy-import `getCurrentRequest()` from `@stacksjs/router`. Cached
 * after first successful resolution so the dynamic import overhead
 * is paid once per process. Returns `undefined` cleanly when the
 * router module isn't available (CLI / migration context) or no
 * request is active.
 */
let _getCurrentRequestCache: (() => unknown) | null | undefined
function lazyGetCurrentRequest(): { url: string, query?: Record<string, string | string[] | undefined> } | undefined {
  if (_getCurrentRequestCache === null) return undefined
  if (_getCurrentRequestCache === undefined) {
    try {
      // eslint-disable-next-line ts/no-require-imports
      const mod = require('@stacksjs/router') as { getCurrentRequest?: () => unknown }
      if (typeof mod.getCurrentRequest === 'function') {
        _getCurrentRequestCache = mod.getCurrentRequest as () => unknown
      }
      else {
        _getCurrentRequestCache = null
        return undefined
      }
    }
    catch {
      _getCurrentRequestCache = null
      return undefined
    }
  }
  const req = _getCurrentRequestCache!() as { url: string, query?: Record<string, string | string[] | undefined> } | undefined
  return req
}

function readNumericQuery(request: { query?: Record<string, string | string[] | undefined> }, key: string): number | undefined {
  const raw = readStringQuery(request, key)
  if (raw === undefined) return undefined
  const n = Number(raw)
  return Number.isFinite(n) ? n : undefined
}

function readStringQuery(request: { query?: Record<string, string | string[] | undefined> }, key: string): string | undefined {
  const value = request.query?.[key]
  if (value === undefined) return undefined
  return Array.isArray(value) ? value[0] : value
}

/** Test helper — reset the lazy-import cache (for tests that mock the
 *  router module after first access). */
export function __resetRequestContextCache(): void {
  _getCurrentRequestCache = undefined
}
