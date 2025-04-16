import { db } from '@stacksjs/database'

export interface Commentable {
  id?: number
  title: string
  body: string
  status: string
  approved_at: number | null
  rejected_at: number | null
  commentable_id: number
  commentable_type: string
  reports_count: number
  reported_at: number | null
  upvotes_count: number
  downvotes_count: number
  user_id: number | null
  created_at: string
  updated_at: string | null
}

export type CommentStatus = 'approved' | 'pending' | 'spam'

export async function fetchComments(options: {
  status?: Commentable['status']
  commentable_id?: number
  commentable_type?: string
  limit?: number
  offset?: number
} = {}): Promise<Commentable[]> {
  let query = db.selectFrom('commentable')

  if (options.status)
    query = query.where('status', '=', options.status)

  if (options.commentable_id)
    query = query.where('commentable_id', '=', options.commentable_id)

  if (options.commentable_type)
    query = query.where('commentable_type', '=', options.commentable_type)

  if (options.limit)
    query = query.limit(options.limit)

  if (options.offset)
    query = query.offset(options.offset)

  return query.selectAll().execute()
}

export async function fetchCommentById(id: number): Promise<Commentable | undefined> {
  return db
    .selectFrom('commentable')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()
}

export async function fetchCommentsByCommentable(
  commentable_id: number,
  commentable_type: string,
  options: { status?: Commentable['status'], limit?: number, offset?: number } = {},
): Promise<Commentable[]> {
  let query = db
    .selectFrom('commentable')
    .where('commentable_id', '=', commentable_id)
    .where('commentable_type', '=', commentable_type)

  if (options.status)
    query = query.where('status', '=', options.status)

  if (options.limit)
    query = query.limit(options.limit)

  if (options.offset)
    query = query.offset(options.offset)

  return query.selectAll().execute()
}

/**
 * Fetch comment counts for different time periods
 *
 * @param days The number of days to look back (e.g., 7, 14, 30, 60, 90)
 * @returns The count of comments within the specified time period
 */
export async function fetchCommentCountByPeriod(days: number): Promise<number> {
  try {
    const result = await db
      .selectFrom('commentable')
      .select(eb => [
        eb.fn.count('id').as('count'),
      ])
      .where('created_at', '>=', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
      .executeTakeFirst()

    return Number(result?.count) || 0
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to fetch comment count: ${error.message}`)
    }

    throw error
  }
}

export async function fetchCommentsByStatus(status: CommentStatus, options: { limit?: number, offset?: number } = {}): Promise<Commentable[]> {
  try {
    let query = db
      .selectFrom('commentable')
      .where('status', '=', status)

    if (options.limit)
      query = query.limit(options.limit)

    if (options.offset)
      query = query.offset(options.offset)

    return query.selectAll().execute()
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to fetch comments by status: ${error.message}`)
    }

    throw error
  }
}

export async function calculateApprovalRate(): Promise<{ approved: number; total: number; rate: number }> {
  try {
    const [approvedResult, totalResult] = await Promise.all([
      db
        .selectFrom('commentable')
        .select(db.fn.count('id').as('count'))
        .where('status', '=', 'approved')
        .executeTakeFirst(),
      db
        .selectFrom('commentable')
        .select(db.fn.count('id').as('count'))
        .executeTakeFirst(),
    ])

    const approved = Number(approvedResult?.count || 0)
    const total = Number(totalResult?.count || 0)
    const rate = total > 0 ? (approved / total) * 100 : 0

    return {
      approved,
      total,
      rate,
    }
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to calculate approval rate: ${error.message}`)
    }

    throw error
  }
}

export interface PostWithCommentCount {
  id: number
  title: string
  comment_count: number
}

export interface DateRange {
  startDate?: string
  endDate?: string
}

export async function fetchPostsWithMostComments(options: { limit?: number, dateRange?: DateRange } = {}): Promise<PostWithCommentCount[]> {
  try {
    let query = db
      .selectFrom('posts')
      .leftJoin('commentable', (join) => join
        .onRef('posts.id', '=', 'commentable.commentable_id')
        .on('commentable.commentable_type', '=', 'posts'))

    if (options.dateRange?.startDate)
      query = query.where('commentable.created_at', '>=', options.dateRange.startDate)

    if (options.dateRange?.endDate)
      query = query.where('commentable.created_at', '<=', options.dateRange.endDate)

    query = query
      .select([
        'posts.id',
        'posts.title',
        db.fn.count('commentable.id').as('comment_count'),
      ])
      .groupBy(['posts.id', 'posts.title'])
      .orderBy('comment_count', 'desc')

    if (options.limit)
      query = query.limit(options.limit)

    const results = await query.execute()

    return results.map(row => ({
      id: row.id,
      title: row.title,
      comment_count: Number(row.comment_count),
    }))
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to fetch posts with most comments: ${error.message}`)
    }

    throw error
  }
}
