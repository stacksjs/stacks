/**
 * Canonical paginator types + adapters (stacksjs/stacks#1905, P1 from #1910).
 *
 * Four pagination shapes used to ship across the framework — bqb's SQL
 * client `{ data, meta }`, bqb's sync ORM `{ data, total, page, ... }`,
 * the search-engine's `{ hits, total, page, perPage }`, and a fifth
 * declared-but-not-implemented Stacks shape (`{ data, paging, next_cursor }`)
 * that the runtime never actually produced. This module unifies them
 * to the Laravel-flavored, snake_case shapes below.
 *
 * P1 ships only `data` + counts; the URL fields are declared but left
 * `undefined` by default. P2 (stacksjs/stacks#1906) wires them in when
 * a request is in scope.
 *
 * Shape choices:
 *   - snake_case for JSON friendliness (matches Laravel's serialized
 *     paginator + the existing REST convention across the Stacks API)
 *   - `from` / `to` are 1-indexed offsets of the first/last row on the
 *     current page; `null` when the page is empty
 *   - `has_more_pages` is the cheap boolean apps actually want — saves
 *     `current_page < last_page` checks everywhere
 */

/**
 * Full paginator — knows the total row count so it can compute
 * `last_page`, supports "jump to page N" UI patterns. Costs an extra
 * `COUNT(*)` query; use {@link SimplePaginator} or {@link CursorPaginator}
 * for very large tables.
 */
export interface Paginator<T> {
  /** Rows on the current page. */
  data: T[]
  /** 1-indexed current page number. Clamped to `[1, last_page]`. */
  current_page: number
  /** Page size. */
  per_page: number
  /** Total rows across all pages. */
  total: number
  /** 1-indexed last page number. `Math.max(1, ceil(total / per_page))`. */
  last_page: number
  /** 1-indexed offset of the first row on the current page; `null` when empty. */
  from: number | null
  /** 1-indexed offset of the last row on the current page; `null` when empty. */
  to: number | null
  /** `current_page < last_page`. */
  has_more_pages: boolean
  /** URL of the previous page; `null` on page 1. Set by P2. */
  prev_page_url?: string | null
  /** URL of the next page; `null` on the last page. Set by P2. */
  next_page_url?: string | null
  /** URL of the first page. Set by P2. */
  first_page_url?: string
  /** URL of the last page. Set by P2. */
  last_page_url?: string
  /** Base path (no query) used to build the page URLs. Set by P2. */
  path?: string
}

/**
 * Simple paginator — drops the `COUNT(*)` query. Faster on large tables
 * but can't render "jump to page 5" UIs since `last_page` / `total` are
 * unknown. Suitable for infinite-scroll feeds.
 */
export interface SimplePaginator<T> {
  data: T[]
  current_page: number
  per_page: number
  has_more_pages: boolean
  prev_page_url?: string | null
  next_page_url?: string | null
  path?: string
}

/**
 * Cursor (keyset) paginator — uses `WHERE id > :cursor` ordering rather
 * than `LIMIT/OFFSET`, so query cost stays constant regardless of how
 * deep the user has paged. The trade-off is no random-access ("jump to
 * page N"); only prev/next.
 *
 * Cursor values are opaque to the caller — serialize as JSON, send to
 * the client, accept back unchanged. Implementations (cursorPaginate)
 * decide the cursor shape (single column value, base64 tuple for
 * composite keys, etc.).
 */
export interface CursorPaginator<T> {
  data: T[]
  per_page: number
  /** Opaque cursor for the next page; `null` when the current page is the last. */
  next_cursor: string | null
  /** Opaque cursor for the previous page; `null` on the first page. */
  prev_cursor: string | null
  has_more_pages: boolean
  prev_page_url?: string | null
  next_page_url?: string | null
  path?: string
}

/** Duck-typed shape check — used by the response serializer (P4) to
 *  detect a paginator-shaped return value from an action. */
export function isPaginator<T = unknown>(value: unknown): value is Paginator<T> {
  if (value === null || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    Array.isArray(v.data)
    && typeof v.current_page === 'number'
    && typeof v.per_page === 'number'
    && typeof v.total === 'number'
    && typeof v.last_page === 'number'
  )
}

/** Duck-typed shape check for the simple paginator. */
export function isSimplePaginator<T = unknown>(value: unknown): value is SimplePaginator<T> {
  if (value === null || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    Array.isArray(v.data)
    && typeof v.current_page === 'number'
    && typeof v.per_page === 'number'
    && typeof v.has_more_pages === 'boolean'
    && !('total' in v)
  )
}

/** Duck-typed shape check for the cursor paginator. */
export function isCursorPaginator<T = unknown>(value: unknown): value is CursorPaginator<T> {
  if (value === null || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    Array.isArray(v.data)
    && (typeof v.next_cursor === 'string' || v.next_cursor === null)
  )
}

/**
 * Convert bun-query-builder's `paginate()` output (`{ data, meta:
 * { perPage, page, total, lastPage } }`) into the canonical Stacks
 * shape. P1 of the migration — the URL fields stay undefined until
 * P2 wires the request-context resolver.
 */
export function toPaginator<T>(
  result: { data: T[], meta: { perPage: number, page: number, total: number, lastPage: number } },
): Paginator<T> {
  const { data } = result
  const { perPage, page, total, lastPage } = result.meta
  const empty = data.length === 0
  const from = empty ? null : (page - 1) * perPage + 1
  const to = empty ? null : from! + data.length - 1
  return {
    data,
    current_page: page,
    per_page: perPage,
    total,
    last_page: lastPage,
    from,
    to,
    has_more_pages: page < lastPage,
  }
}

/** Convert bqb's `simplePaginate()` output to the canonical
 *  {@link SimplePaginator} shape. */
export function toSimplePaginator<T>(
  result: { data: T[], meta: { perPage: number, page: number, hasMore: boolean } },
): SimplePaginator<T> {
  return {
    data: result.data,
    current_page: result.meta.page,
    per_page: result.meta.perPage,
    has_more_pages: result.meta.hasMore,
  }
}

/** Convert bqb's `cursorPaginate()` output to the canonical
 *  {@link CursorPaginator} shape. Cursors are serialized to strings
 *  via JSON — composite cursors (arrays) survive the round-trip. */
export function toCursorPaginator<T>(
  result: { data: T[], meta: { perPage: number, nextCursor: unknown, prevCursor: unknown } },
): CursorPaginator<T> {
  return {
    data: result.data,
    per_page: result.meta.perPage,
    next_cursor: serializeCursor(result.meta.nextCursor),
    prev_cursor: serializeCursor(result.meta.prevCursor),
    has_more_pages: result.meta.nextCursor !== null && result.meta.nextCursor !== undefined,
  }
}

function serializeCursor(cursor: unknown): string | null {
  if (cursor === null || cursor === undefined) return null
  if (typeof cursor === 'string') return cursor
  // Composite cursor (array of column values) or numeric — JSON-stringify
  // so the wire format is stable across drivers and the value survives a
  // round-trip through `?cursor=...` without any consumer-side parsing.
  return JSON.stringify(cursor)
}
