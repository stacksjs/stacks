import { db, sql } from '@stacksjs/database/runtime'
import type { ListQuery, QueryReader } from './content-list'
import { countOf, pageWithin, parseListQuery } from './content-list'

/**
 * One page of the dashboard's CMS pages list, read by the database.
 *
 * The list used to `SELECT *` every page, block documents included, and hand
 * the whole table to the browser to search and page (stacksjs/stacks#3192).
 * Now the database searches, sorts, counts and pages, and a row carries only
 * the columns the list shows and the editor edits.
 */

export const PAGE_SORTS = ['created_at', 'title', 'published'] as const

export type PageSort = typeof PAGE_SORTS[number]
export type PageListQuery = ListQuery<PageSort>

export interface PageListRow {
  id: number
  title: string | null
  template: string | null
  views: number | null
  conversions: number | null
  published_at: string | null
  author_id: number | null
  created_at: string | null
  updated_at: string | null
}

export interface PageListPage {
  rows: PageListRow[]
  /** Pages matching the search, which the pager counts. */
  total: number
  /** The page the rows are, moved back to the last one when it ran past it. */
  page: number
  /** Every page, whatever the search, for the summary cards. */
  allCount: number
  totalViews: number
  totalConversions: number
  /** The most recently created page's title, or empty when there are none. */
  newestTitle: string
}

export function parsePageListQuery(read: QueryReader): PageListQuery | { error: string } {
  return parseListQuery(read, PAGE_SORTS)
}

/** The search that a page and its count share: the title, and the template shown under it. */
function filtered(query: PageListQuery, database: typeof db): any {
  let chain: any = database.selectFrom('pages')
  if (query.search) {
    const term = `%${query.search}%`
    chain = chain.whereGroup((group: any) => group
      .whereLike('title', term)
      .orWhereLike('template', term))
  }
  return chain
}

/**
 * The same order on every dialect. "Published" is whether a page has a
 * publish date, drafts first ascending as the table always sorted the badge,
 * then by that date; titles compare without case. The id breaks ties so a
 * page boundary is stable between requests.
 */
function ordered(chain: any, query: PageListQuery): any {
  const direction = query.direction === 'asc' ? 'ASC' : 'DESC'
  if (query.sort === 'published')
    chain = chain.orderByRaw(sql.raw(`CASE WHEN published_at IS NULL THEN 0 ELSE 1 END ${direction}, published_at ${direction}`))
  else if (query.sort === 'title')
    chain = chain.orderByRaw(sql.raw(`LOWER(title) ${direction}`))
  else
    chain = chain.orderBy(query.sort, query.direction)
  return chain.orderBy('id', 'desc')
}

export async function readPageListPage(query: PageListQuery, database: typeof db = db): Promise<PageListPage> {
  const total = countOf((await filtered(query, database).select(database.fn.count('id').as('count')).executeTakeFirst() as { count?: unknown } | undefined)?.count)
  const page = pageWithin(query.page, total, query.perPage)

  const rows = total === 0
    ? []
    : await ordered(filtered(query, database), query)
        .select(['id', 'title', 'template', 'views', 'conversions', 'published_at', 'author_id', 'created_at', 'updated_at'])
        .limit(query.perPage)
        .offset((page - 1) * query.perPage)
        .execute() as PageListRow[]

  const [totals, newest] = await Promise.all([
    database.selectFrom('pages').select([
      database.fn.count('id').as('count'),
      database.fn.sum('views').as('views'),
      database.fn.sum('conversions').as('conversions'),
    ]).executeTakeFirst() as unknown as { count?: unknown, views?: unknown, conversions?: unknown } | undefined,
    database.selectFrom('pages').select(['title']).orderBy('created_at', 'desc').orderBy('id', 'desc').limit(1).executeTakeFirst() as unknown as { title?: string | null } | undefined,
  ])

  return {
    rows,
    total,
    page,
    allCount: countOf(totals?.count),
    totalViews: countOf(totals?.views),
    totalConversions: countOf(totals?.conversions),
    newestTitle: String(newest?.title || ''),
  }
}
