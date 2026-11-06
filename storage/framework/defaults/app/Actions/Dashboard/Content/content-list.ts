/**
 * The query a paged dashboard content list takes, read and checked once for
 * every list that pages on the server (stacksjs/stacks#3191, #3192).
 */

export const LIST_PAGE_SIZES = [10, 25, 50, 100] as const

export interface ListQuery<Sort extends string> {
  page: number
  perPage: number
  search: string
  sort: Sort
  direction: 'asc' | 'desc'
}

/** Reads one query value, in whatever shape the request holds it. */
export type QueryReader = (key: string) => unknown

/** One value as a string: the first of a repeated key, or empty when absent. */
export function queryText(read: QueryReader, key: string): string {
  const value = read(key)
  if (Array.isArray(value))
    return value.length > 0 ? String(value[0]).trim() : ''
  return value === undefined || value === null ? '' : String(value).trim()
}

/**
 * The page, size, search and sort, or the reason they are invalid.
 *
 * Absent values take the defaults these pages have always shown: the first
 * page of 25, newest first. A value that is present and wrong is an error
 * rather than a silent default, so a broken caller is visible.
 */
export function parseListQuery<Sort extends string>(read: QueryReader, sorts: readonly Sort[]): ListQuery<Sort> | { error: string } {
  const pageText = queryText(read, 'page')
  const page = pageText === '' ? 1 : Number(pageText)
  if (!Number.isInteger(page) || page < 1)
    return { error: 'page must be a whole number of 1 or more.' }

  const sizeText = queryText(read, 'per_page')
  const perPage = sizeText === '' ? 25 : Number(sizeText)
  if (!(LIST_PAGE_SIZES as readonly number[]).includes(perPage))
    return { error: `per_page must be one of ${LIST_PAGE_SIZES.join(', ')}.` }

  const sort = queryText(read, 'sort') || 'created_at'
  if (!(sorts as readonly string[]).includes(sort))
    return { error: `sort must be one of ${sorts.join(', ')}.` }

  const directionText = queryText(read, 'direction').toLowerCase()
  const direction = directionText === '' ? (sort === 'created_at' ? 'desc' : 'asc') : directionText
  if (direction !== 'asc' && direction !== 'desc')
    return { error: 'direction must be asc or desc.' }

  const search = queryText(read, 'search')
  if (search.length > 200)
    return { error: 'search must be 200 characters or fewer.' }

  return { page, perPage, search, sort: sort as Sort, direction }
}

/** The page to show: the one asked for, or the last one when it ran past the end. */
export function pageWithin(page: number, total: number, perPage: number): number {
  return Math.min(page, Math.max(1, Math.ceil(total / perPage)))
}

/** A COUNT or SUM read back as a number, whichever type the driver returned. */
export function countOf(value: unknown): number {
  return Number(value ?? 0) || 0
}

/**
 * A `LIKE` pattern that matches `term` anywhere, ignoring case, with its own
 * `%` and `_` taken literally. Use it with `ESCAPE '!'`: `!` means the same in
 * every dialect, where SQLite has no default escape and MySQL reads a
 * backslash in a string literal as an escape of its own.
 */
export function containsPattern(term: string): string {
  return `%${term.toLowerCase().replace(/[!%_]/g, character => `!${character}`)}%`
}
