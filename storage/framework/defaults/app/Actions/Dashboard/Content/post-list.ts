import { db, sql } from '@stacksjs/database/runtime'
import type { ListQuery, QueryReader } from './content-list'
import { countOf, LIST_PAGE_SIZES, pageWithin, parseListQuery, queryText } from './content-list'

/**
 * One page of the dashboard's posts list, read by the database.
 *
 * The list used to read every post, article bodies included, and hand the
 * whole table to the browser to search and page through 25 at a time
 * (stacksjs/stacks#3191). Now the database filters, counts, sorts and pages,
 * and a row carries a short preview of its body instead of all of it. The
 * editor reads one post's body when it opens (`PostShowAction`).
 */

export const POST_PAGE_SIZES = LIST_PAGE_SIZES
export const POST_STATUSES = ['draft', 'published', 'archived'] as const
export const POST_SORTS = ['created_at', 'title', 'status', 'views'] as const

/** How much of a post's body a list row carries, for posts with no excerpt. */
export const POST_PREVIEW_LENGTH = 240

export type PostStatus = typeof POST_STATUSES[number]
export type PostSort = typeof POST_SORTS[number]

export interface PostListQuery extends ListQuery<PostSort> {
  status: PostStatus | 'all'
}

export interface PostListRow {
  id: number
  title: string
  excerpt: string | null
  preview: string | null
  poster: string | null
  status: string | null
  views: number | null
  published_at: string | null
  created_at: string | null
  updated_at: string | null
  author_id: number | null
  is_featured: number | boolean | null
}

export interface PostPage {
  rows: PostListRow[]
  /** Posts matching the search and status, which the pager counts. */
  total: number
  /** The page the rows are, moved back to the last one when it ran past it. */
  page: number
  /** Every post, whatever the search, for the page's summary cards. */
  allCount: number
  publishedCount: number
  draftCount: number
  archivedCount: number
  totalViews: number
}

/** The list query, with the post status filter on top of the shared one. */
export function parsePostListQuery(read: QueryReader): PostListQuery | { error: string } {
  const list = parseListQuery(read, POST_SORTS)
  if ('error' in list)
    return list

  const status = queryText(read, 'status') || 'all'
  if (status !== 'all' && !(POST_STATUSES as readonly string[]).includes(status))
    return { error: `status must be all or one of ${POST_STATUSES.join(', ')}.` }

  return { ...list, status: status as PostListQuery['status'] }
}

/** The search and status that a page and its count share. */
function filtered(query: PostListQuery, database: typeof db): any {
  let chain: any = database.selectFrom('posts')
  if (query.status !== 'all')
    chain = chain.where('status', '=', query.status)
  if (query.search) {
    // Bound, and compared lowercased on every dialect. A `%` or `_` the
    // viewer types matches as a wildcard, as it does on the models page. The
    // builder would parenthesise the ORs anyway; the group says so.
    const term = `%${query.search}%`
    chain = chain.whereGroup((group: any) => group
      .whereLike('title', term)
      .orWhereLike('excerpt', term)
      .orWhereLike('content', term))
  }
  return chain
}

/**
 * The order, the same on every dialect. `status` is an enum, which PostgreSQL
 * and MySQL sort by declaration and SQLite sorts as text, so its order is
 * spelled out; titles compare without case, as the table always sorted them.
 * The id last keeps a page boundary stable between requests.
 */
function ordered(chain: any, query: PostListQuery): any {
  const direction = query.direction === 'asc' ? 'ASC' : 'DESC'
  if (query.sort === 'status')
    chain = chain.orderByRaw(sql.raw(`CASE status WHEN 'published' THEN 0 WHEN 'draft' THEN 1 ELSE 2 END ${direction}`))
  else if (query.sort === 'title')
    chain = chain.orderByRaw(sql.raw(`LOWER(title) ${direction}`))
  else
    chain = chain.orderBy(query.sort, query.direction)
  return chain.orderBy('id', 'desc')
}

export async function readPostPage(query: PostListQuery, database: typeof db = db): Promise<PostPage> {
  const total = countOf((await filtered(query, database).select(database.fn.count('id').as('count')).executeTakeFirst() as { count?: unknown } | undefined)?.count)
  const page = pageWithin(query.page, total, query.perPage)

  const rows = total === 0
    ? []
    : await ordered(filtered(query, database), query)
        .select([
          'id', 'title', 'excerpt', 'poster', 'status', 'views', 'published_at', 'created_at', 'updated_at', 'author_id', 'is_featured',
          sql.raw(`SUBSTR(content, 1, ${POST_PREVIEW_LENGTH}) AS preview`),
        ])
        .limit(query.perPage)
        .offset((page - 1) * query.perPage)
        .execute() as PostListRow[]

  const [byStatus, views] = await Promise.all([
    database.selectFrom('posts').select(['status', database.fn.count('id').as('count')]).groupBy('status').execute() as Promise<Array<{ status: string, count: unknown }>>,
    database.selectFrom('posts').select(database.fn.sum('views').as('views')).executeTakeFirst() as Promise<{ views?: unknown } | undefined>,
  ])

  const statusCount = (status: PostStatus) => byStatus
    .filter(row => String(row.status).toLowerCase() === status)
    .reduce((sum, row) => sum + countOf(row.count), 0)

  return {
    rows,
    total,
    page,
    allCount: byStatus.reduce((sum, row) => sum + countOf(row.count), 0),
    publishedCount: statusCount('published'),
    draftCount: statusCount('draft'),
    archivedCount: statusCount('archived'),
    totalViews: countOf(views?.views),
  }
}
