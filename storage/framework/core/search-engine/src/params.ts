import type { SearchEngineSearchParams, SearchFilter, SearchSort } from '@stacksjs/types'

/**
 * The search parameters every driver reads, resolved once.
 *
 * Each driver used to read its own subset of names. The ORM's builder sends
 * `{ q, limit, offset, filter }`; Meilisearch read `query`, `page` and
 * `perPage`, found none of them, and searched for nothing - so
 * `Product.search('widget').get()` returned the first twenty documents in the
 * index, and `.paginate(10, 3)` returned page one every time. Resolving the
 * contract here, once, is what keeps the drivers from drifting apart again.
 */
export interface ResolvedSearchParams {
  /** The search text; '' when none was given. */
  query: string
  limit: number
  offset: number
  filter?: SearchFilter
  sort?: SearchSort
}

export const DEFAULT_SEARCH_LIMIT = 20

function nonNegativeInteger(name: string, value: unknown): number {
  const n = Number(value)
  if (!Number.isInteger(n) || n < 0)
    throw new TypeError(`[search] \`${name}\` must be a non-negative integer, got ${JSON.stringify(value)}`)
  return n
}

export function resolveSearchParams(
  params: SearchEngineSearchParams | string | undefined,
  defaultLimit: number = DEFAULT_SEARCH_LIMIT,
): ResolvedSearchParams {
  const p: SearchEngineSearchParams = typeof params === 'string' ? { q: params } : (params ?? {})

  const rawQuery = p.q ?? p.query
  const query = rawQuery == null ? '' : String(rawQuery)

  const rawLimit = p.limit ?? p.perPage
  const limit = rawLimit == null ? defaultLimit : nonNegativeInteger(p.limit != null ? 'limit' : 'perPage', rawLimit)

  let offset = 0
  if (p.offset != null) {
    offset = nonNegativeInteger('offset', p.offset)
  }
  else if (p.page != null) {
    const page = nonNegativeInteger('page', p.page)
    if (page < 1)
      throw new TypeError('[search] `page` is 1-based and must be at least 1')
    offset = (page - 1) * limit
  }

  return { query, limit, offset, filter: p.filter, sort: p.sort }
}

/** An object filter: `{ field: value }`, as opposed to engine syntax. */
export function isObjectFilter(filter: unknown): filter is Record<string, unknown> {
  return typeof filter === 'object' && filter !== null && !Array.isArray(filter)
}

/**
 * Field names go into a filter DSL as identifiers, so only identifier
 * characters (plus `.` for nested paths) are accepted. Without the check a key
 * like `"category';TRUNCATE INDEX;'"` closes the clause and injects its own.
 */
export const SAFE_FILTER_FIELD: RegExp = /^[a-z_]\w*(?:\.[a-z_]\w*)*$/i

export function assertSafeField(driver: string, field: string): void {
  if (!SAFE_FILTER_FIELD.test(field))
    throw new Error(`[search/${driver}] Refusing to build filter with unsafe field name: ${field}`)
}

/** `{ price: 'desc', name: 'asc' }` as `['price:desc', 'name:asc']`; strings pass through. */
export function sortToList(driver: string, sort: SearchSort | undefined): string[] {
  if (sort == null)
    return []
  if (typeof sort === 'string')
    return sort ? [sort] : []
  if (Array.isArray(sort))
    return sort.filter(Boolean)

  const rules: string[] = []
  for (const [field, direction] of Object.entries(sort)) {
    assertSafeField(driver, field)
    rules.push(`${field}:${String(direction).toLowerCase() === 'desc' ? 'desc' : 'asc'}`)
  }
  return rules
}
