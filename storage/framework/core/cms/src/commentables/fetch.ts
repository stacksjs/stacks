import { db } from '@stacksjs/database'
import { formatDate } from '@stacksjs/orm'

export interface Commentable {
  id?: number
  title: string
  body: string
  status: string
  approved_at: number | null
  rejected_at: number | null
  commentables_id: number
  commentables_type: string
  reports_count?: number
  reported_at?: number | null
  upvotes_count?: number
  downvotes_count?: number
  user_id: number | null
  created_at?: string
  updated_at?: string | null
}

export type CommentStatus = 'approved' | 'pending' | 'spam'

export async function fetchComments(options: {
  status?: Commentable['status']
  commentables_id?: number
  commentables_type?: string
  limit?: number
  offset?: number
} = {}): Promise<Commentable[]> {
  let query = db.selectFrom('commentables')

  if (options.status)
    query = query.where('status', '=', options.status)

  if (options.commentables_id)
    query = query.where('commentables_id', '=', options.commentables_id)

  if (options.commentables_type)
    query = query.where('commentables_type', '=', options.commentables_type)

  if (options.limit)
    query = query.limit(options.limit)

  if (options.offset)
    query = query.offset(options.offset)

  return query.selectAll().execute()
}

export async function fetchCommentById(id: number): Promise<Commentable | undefined> {
  return db
    .selectFrom('commentables')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()
}

export async function fetchCommentsByCommentables(
  commentables_id: number,
  commentables_type: string,
  options: { status?: Commentable['status'], limit?: number, offset?: number } = {},
): Promise<Commentable[]> {
  let query = db
    .selectFrom('commentables')
    .where('commentables_id', '=', commentables_id)
    .where('commentables_type', '=', commentables_type)

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
      .selectFrom('commentables')
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
      .selectFrom('commentables')
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

export async function calculateApprovalRate(): Promise<{ approved: number, total: number, rate: number }> {
  try {
    const [approvedResult, totalResult] = await Promise.all([
      db
        .selectFrom('commentables')
        .select(db.fn.count('id').as('count'))
        .where('status', '=', 'approved')
        .executeTakeFirst(),
      db
        .selectFrom('commentables')
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
  startDate: Date
  endDate: Date
}

export async function fetchPostsWithMostComments(dateRange: DateRange, options: { limit?: number } = {}): Promise<PostWithCommentCount[]> {
  try {
    let query = db
      .selectFrom('posts')
      .leftJoin('commentables', join => join
        .onRef('posts.id', '=', 'commentables.commentables_id')
        .on('commentables.commentables_type', '=', 'posts'))
      .where('commentables.created_at', '>=', formatDate(dateRange.startDate))
      .where('commentables.created_at', '<=', formatDate(dateRange.endDate))
      .select([
        'posts.id',
        'posts.title',
        db.fn.count('commentables.id').as('comment_count'),
      ])
      .groupBy(['posts.id', 'posts.title'])
      .orderBy('comment_count', 'desc')

    if (options.limit)
      query = query.limit(options.limit)

    const results = await query.execute()

    return results.map(row => ({
      id: Number(row.id),
      title: String(row.title),
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

export interface BarGraphData {
  labels: string[]
  values: number[]
}

export async function fetchCommentCountBarGraph(dateRange: DateRange, options: { limit?: number } = {}): Promise<BarGraphData> {
  try {
    const posts = await fetchPostsWithMostComments(dateRange, options)

    return {
      labels: posts.map(post => post.title),
      values: posts.map(post => post.comment_count),
    }
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to fetch bar graph data: ${error.message}`)
    }

    throw error
  }
}

export interface DonutGraphData {
  labels: string[]
  values: number[]
  percentages: number[]
}

export async function fetchStatusDistributionDonut(dateRange: DateRange): Promise<DonutGraphData> {
  try {
    const results = await db
      .selectFrom('commentables')
      .where('created_at', '>=', formatDate(dateRange.startDate))
      .where('created_at', '<=', formatDate(dateRange.endDate))
      .select([
        'status',
        db.fn.count('id').as('count'),
      ])
      .groupBy('status')
      .execute()

    const total = results.reduce((sum, row) => sum + Number(row.count), 0)
    const labels = results.map(row => row.status)
    const values = results.map(row => Number(row.count))
    const percentages = values.map(value => total > 0 ? (value / total) * 100 : 0)

    return {
      labels,
      values,
      percentages,
    }
  }
  catch (error) {
    if (error instanceof Error)
      throw new TypeError(`Failed to fetch status distribution: ${error.message}`)

    throw error
  }
}

export interface LineGraphData {
  labels: string[]
  values: number[]
}

export async function fetchMonthlyCommentCounts(dateRange: DateRange): Promise<LineGraphData> {
  try {
    const results = await db
      .selectFrom('commentables')
      .where('created_at', '>=', formatDate(dateRange.startDate))
      .where('created_at', '<=', formatDate(dateRange.endDate))
      .select([
        db.fn.count('id').as('count'),
        'created_at',
      ])
      .groupBy('created_at')
      .orderBy('created_at', 'asc')
      .execute()

    // Group results by year and month
    const monthlyCounts = new Map<string, number>()
    results.forEach((row: { created_at: string | undefined, count: string | number | bigint }) => {
      if (!row.created_at)
        return
      const date = new Date(row.created_at)
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      monthlyCounts.set(key, (monthlyCounts.get(key) || 0) + Number(row.count))
    })

    // Convert to arrays for the graph
    const labels: string[] = []
    const values: number[] = []
    monthlyCounts.forEach((count, key) => {
      const [year, month] = key.split('-')
      labels.push(new Date(Number(year), Number(month) - 1).toLocaleString('default', { month: 'short', year: 'numeric' }))
      values.push(count)
    })

    return { labels, values }
  }
  catch (error) {
    if (error instanceof Error)
      throw new TypeError(`Failed to fetch monthly comment counts: ${error.message}`)

    throw error
  }
}
