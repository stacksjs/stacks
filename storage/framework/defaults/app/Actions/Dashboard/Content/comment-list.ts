import { db, getDatabaseDialect, sqlHelpers } from '@stacksjs/database/runtime'
import type { CommentableRow, CommentStatus, DashboardComment } from './comment-input'
import { COMMENT_STATUSES, commentableRecord, dashboardStatusForCommentable, isMissingTableError, isSafeTableName, newestFirst, normalizeCommentStatus, parseCommentableRow } from './comment-input'
import type { ListQuery, QueryReader } from './content-list'
import { countOf, pageWithin, parseListQuery, queryText } from './content-list'

/**
 * One page of the dashboard's comments, read by the database.
 *
 * Comments live in two tables: `comments`, the CMS table, and `commentables`,
 * the polymorphic one the `commentable` trait writes. The list used to read
 * both whole and the page rendered every comment at once
 * (stacksjs/stacks#3193). Now each table is searched, filtered and counted in
 * SQL. A page is newest first across both: for page p of n, each table gives
 * its newest p * n matches, which must hold the page, and the two are merged
 * by date and sliced. That costs more for deep pages, never more than the
 * matching rows.
 */

export type CommentListQuery = ListQuery<'created_at'> & { status: CommentStatus | 'all' }

export interface CommentCounts {
  all: number
  pending: number
  approved: number
  spam: number
  trash: number
}

export interface CommentPage {
  rows: DashboardComment[]
  /** Comments matching the search and status, which the pager counts. */
  total: number
  /** The page the rows are, moved back to the last one when it ran past it. */
  page: number
  /** Every comment by status, whatever the search, for the summary cards. */
  counts: CommentCounts
}

export function parseCommentListQuery(read: QueryReader): CommentListQuery | { error: string } {
  const list = parseListQuery(read, ['created_at'] as const)
  if ('error' in list)
    return list
  if (list.direction !== 'desc')
    return { error: 'Comments are listed newest first; direction must be desc.' }

  const status = queryText(read, 'status') || 'all'
  if (status !== 'all' && !(COMMENT_STATUSES as readonly string[]).includes(status))
    return { error: `status must be all or one of ${COMMENT_STATUSES.join(', ')}.` }

  return { ...list, status: status as CommentListQuery['status'] }
}

/** A timestamp as text that sorts: PostgreSQL hands back a Date, SQLite a string. */
function timestampText(value: unknown): string | null {
  if (value instanceof Date)
    return Number.isNaN(value.getTime()) ? null : value.toISOString()
  return value === undefined || value === null || value === '' ? null : String(value)
}

/* ------------------------------------------------------------ comments */

interface CommentRow {
  id: number
  author_name: string | null
  author_email: string | null
  content: string | null
  body: string | null
  post_title: string | null
  status: string | null
  is_approved: number | boolean | null
  created_at: unknown
  updated_at: unknown
}

function legacyRecord(row: CommentRow): DashboardComment {
  return {
    key: `comments:${row.id}`,
    source: 'comments',
    id: Number(row.id),
    author_name: String(row.author_name || ''),
    author_email: String(row.author_email || ''),
    content: String(row.content || row.body || ''),
    post_title: String(row.post_title || ''),
    status: normalizeCommentStatus(row.status),
    is_approved: Boolean(row.is_approved),
    created_at: timestampText(row.created_at),
    updated_at: timestampText(row.updated_at),
  }
}

/** `comments.status` is an enum or CHECK of exactly these values, so it compares as is. */
function legacyFiltered(query: CommentListQuery): any {
  let chain: any = db.selectFrom('comments')
  if (query.status !== 'all')
    chain = chain.where('status', '=', query.status)
  if (query.search) {
    const term = `%${query.search}%`
    chain = chain.whereGroup((group: any) => group
      .whereLike('content', term)
      .orWhereLike('body', term)
      .orWhereLike('author_name', term)
      .orWhereLike('author_email', term)
      .orWhereLike('post_title', term))
  }
  return chain
}

async function legacyTotal(query: CommentListQuery): Promise<number> {
  return countOf((await legacyFiltered(query).select(db.fn.count('id').as('count')).executeTakeFirst() as { count?: unknown } | undefined)?.count)
}

async function legacyRows(query: CommentListQuery, limit: number): Promise<DashboardComment[]> {
  const rows = await legacyFiltered(query)
    .select(['id', 'author_name', 'author_email', 'content', 'body', 'post_title', 'status', 'is_approved', 'created_at', 'updated_at'])
    .orderBy('created_at', 'desc')
    .orderBy('id', 'desc')
    .limit(limit)
    .execute() as CommentRow[]

  return rows.map(legacyRecord)
}

/* -------------------------------------------------------- commentables */

/**
 * The column that names each kind of thing a trait comment was left on, by
 * table: its title, else its name. A type that is not a safe identifier, has
 * no such table, or has neither column has none, and its comments show a
 * plain `posts #3` label, as they always did.
 */
async function ownerLabelColumns(types: string[]): Promise<Map<string, 'title' | 'name'>> {
  const columns = new Map<string, 'title' | 'name'>()
  for (const type of types) {
    if (!isSafeTableName(type))
      continue
    for (const column of ['title', 'name'] as const) {
      try {
        await db.unsafe(`SELECT id, ${column} FROM ${type} WHERE 1 = 0`).execute()
        columns.set(type, column)
        break
      }
      catch {
        // No such table or no such column: try the next column, then none.
      }
    }
  }
  return columns
}

/** What each trait comment on the page was left on, keyed `type:id`. */
async function ownerLabels(rows: CommentableRow[], columns: Map<string, 'title' | 'name'>): Promise<Map<string, string>> {
  const labels = new Map<string, string>()
  const idsByType = new Map<string, number[]>()

  for (const row of rows) {
    const type = String(row.commentables_type || '')
    labels.set(`${type}:${row.commentables_id}`, `${type} #${row.commentables_id}`)
    if (columns.has(type))
      idsByType.set(type, [...(idsByType.get(type) ?? []), Number(row.commentables_id)])
  }

  for (const [type, ids] of idsByType) {
    const column = columns.get(type)!
    const owners = await (db as any).selectFrom(type).select(['id', column]).whereIn('id', [...new Set(ids)]).execute() as Array<Record<string, unknown>>
    for (const owner of owners) {
      const label = String(owner[column] ?? '').trim()
      if (label)
        labels.set(`${type}:${owner.id}`, label)
    }
  }

  return labels
}

/**
 * The trait's status column is free text, so it is compared lowercased. It has
 * one hidden state, `rejected`, which the dashboard shows as spam, and none
 * that shows as trash. The values are constants, never input.
 */
const COMMENTABLE_STATUS_SQL: Record<CommentStatus, string> = {
  approved: `LOWER(status) = 'approved'`,
  spam: `LOWER(status) = 'rejected'`,
  trash: '1 = 0',
  pending: `(status IS NULL OR LOWER(status) NOT IN ('approved', 'rejected'))`,
}

/**
 * The WHERE clause for trait comments, and its bound values.
 *
 * Raw rather than the builder because a match on what a comment was left on
 * is a subquery per owner table, and the builder takes no bound values in a
 * raw fragment. Every value here is bound; only table and column names that
 * passed `isSafeTableName` and the probe above are written into the text.
 */
function commentableWhere(query: CommentListQuery, columns: Map<string, 'title' | 'name'>, guestAuthors: boolean): { sql: string, values: unknown[] } {
  const helpers = sqlHelpers(getDatabaseDialect())
  const clauses: string[] = []
  const values: unknown[] = []
  const bind = (value: unknown): string => {
    values.push(value)
    return helpers.param(values.length)
  }

  if (query.status !== 'all')
    clauses.push(COMMENTABLE_STATUS_SQL[query.status])

  if (query.search) {
    const term = `%${query.search}%`
    const searched = guestAuthors ? ['title', 'body', 'author_name', 'author_email'] : ['title', 'body']
    const matches = searched.map(column => `LOWER(${column}) LIKE LOWER(${bind(term)})`)
    for (const [type, column] of columns)
      matches.push(`(commentables_type = '${type}' AND commentables_id IN (SELECT id FROM ${type} WHERE LOWER(${column}) LIKE LOWER(${bind(term)})))`)
    clauses.push(`(${matches.join(' OR ')})`)
  }

  return { sql: clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '', values }
}

interface CommentableSource {
  columns: Map<string, 'title' | 'name'>
  guestAuthors: boolean
  where: { sql: string, values: unknown[] }
  total: number
  statusRows: Array<{ status: unknown, count: unknown }>
}

/** The trait comments' filter, match count and status counts, or null without the table. */
async function prepareCommentables(query: CommentListQuery): Promise<CommentableSource | null> {
  let types: string[]
  try {
    const found = await db.unsafe('SELECT DISTINCT commentables_type FROM commentables').execute() as Array<{ commentables_type: string }>
    types = found.map(row => String(row.commentables_type))
  }
  catch (error) {
    // An app that never migrated the trait tables has no trait comments,
    // which is not an error; any other failure is.
    if (isMissingTableError(error))
      return null
    throw error
  }

  // The guest-author columns came after the table, and `migrate` adds them.
  // Until it has, a trait comment has no author name or email, as before,
  // rather than the list failing.
  let guestAuthors = true
  try {
    await db.unsafe('SELECT author_name, author_email FROM commentables WHERE 1 = 0').execute()
  }
  catch {
    guestAuthors = false
  }

  const columns = await ownerLabelColumns(types)
  const where = commentableWhere(query, columns, guestAuthors)
  const [[counted], statusRows] = await Promise.all([
    db.unsafe(`SELECT COUNT(id) AS count FROM commentables ${where.sql}`, where.values).execute() as Promise<Array<{ count: unknown }>>,
    db.unsafe('SELECT status, COUNT(id) AS count FROM commentables GROUP BY status').execute() as Promise<Array<{ status: unknown, count: unknown }>>,
  ])

  return { columns, guestAuthors, where, total: countOf(counted?.count), statusRows }
}

async function commentableRows(source: CommentableSource, limit: number): Promise<DashboardComment[]> {
  const rows = (await db.unsafe(
    `SELECT id, title, body, status, commentables_id, commentables_type, user_id, ${source.guestAuthors ? 'author_name, author_email' : 'NULL AS author_name, NULL AS author_email'}, created_at, updated_at
     FROM commentables ${source.where.sql} ORDER BY created_at DESC, id DESC LIMIT ${Math.trunc(limit)}`,
    source.where.values,
  ).execute()).map(parseCommentableRow)

  const labels = await ownerLabels(rows, source.columns)
  return rows.map(row => ({
    ...commentableRecord(row, labels.get(`${row.commentables_type}:${row.commentables_id}`) ?? ''),
    created_at: timestampText(row.created_at),
    updated_at: timestampText(row.updated_at),
  }))
}

/* ---------------------------------------------------------------- page */

async function legacyCounts(): Promise<Array<{ status: unknown, count: unknown }>> {
  return await db.selectFrom('comments').select(['status', db.fn.count('id').as('count')]).groupBy('status').execute() as Array<{ status: unknown, count: unknown }>
}

export async function readCommentPage(query: CommentListQuery): Promise<CommentPage> {
  // The totals first, so the page can be moved back inside them before any
  // row is read.
  const [commentTotal, trait, legacyStatusRows] = await Promise.all([legacyTotal(query), prepareCommentables(query), legacyCounts()])
  const total = commentTotal + (trait?.total ?? 0)
  const page = pageWithin(query.page, total, query.perPage)
  const limit = page * query.perPage

  const [legacy, traitRows] = await Promise.all([
    commentTotal > 0 ? legacyRows(query, limit) : Promise.resolve([]),
    trait && trait.total > 0 ? commentableRows(trait, limit) : Promise.resolve([]),
  ])

  const counts: CommentCounts = { all: 0, pending: 0, approved: 0, spam: 0, trash: 0 }
  for (const row of legacyStatusRows)
    counts[normalizeCommentStatus(row.status)] += countOf(row.count)
  for (const row of trait?.statusRows ?? [])
    counts[dashboardStatusForCommentable(row.status)] += countOf(row.count)
  counts.all = counts.pending + counts.approved + counts.spam + counts.trash

  return {
    rows: [...legacy, ...traitRows].sort(newestFirst).slice((page - 1) * query.perPage, limit),
    total,
    page,
    counts,
  }
}
