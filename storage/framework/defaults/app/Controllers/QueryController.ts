import { config } from '@stacksjs/config'
import { db, sql } from '@stacksjs/database'
import { Controller } from '@stacksjs/server'

export default class QueryController extends Controller {
  /**
   * Get query statistics for the dashboard
   */
  async getStats() {
    try {
      // Get the total number of queries
      const totalQueries = await db
        .selectFrom('query_logs')
        .select(db.fn.count('id').as('count'))
        .executeTakeFirstOrThrow()

      // Get counts by query type
      const queryTypeStats = await db
        .selectFrom('query_logs')
        .select([
          sql`json_extract(tags, "$[0]")`.as('type'),
          db.fn.count('id').as('count'),
        ])
        .groupBy(sql`json_extract(tags, "$[0]")`)
        .execute()

      // Get counts by status
      const statusStats = await db
        .selectFrom('query_logs')
        .select(['status', db.fn.count('id').as('count')])
        .groupBy('status')
        .execute()

      // Get average duration by query type
      const durationStats = await db
        .selectFrom('query_logs')
        .select([
          sql`json_extract(tags, "$[0]")`.as('type'),
          db.fn.avg('duration').as('avg_duration'),
        ])
        .groupBy(sql`json_extract(tags, "$[0]")`)
        .execute()

      // Get count of slow queries over time (last 24 hours)
      const slowQueriesTimeline = await db
        .selectFrom('query_logs')
        .select([
          sql`strftime("%Y-%m-%d %H:00:00", executed_at)`.as('hour'),
          db.fn.count('id').as('count'),
        ])
        .where('status', '=', 'slow')
        .whereRaw(sql`executed_at >= datetime("now", "-1 day")`)
        .groupBy(sql`strftime("%Y-%m-%d %H:00:00", executed_at)`)
        .orderBy('hour')
        .execute()

      return {
        totalQueries: totalQueries.count,
        byType: queryTypeStats,
        byStatus: statusStats,
        avgDuration: durationStats,
        slowQueriesTimeline,
        // Include system settings for reference
        settings: {
          slowThreshold: config.database?.queryLogging?.slowThreshold || 100,
        },
      }
    }
    catch (error: unknown) {
      const err = error as Error
      throw new Error(`Failed to fetch query statistics: ${err.message}`)
    }
  }

  /**
   * Get a paginated list of recent queries
   */
  async getRecentQueries({
    page = 1,
    perPage = 10,
    connection = 'all',
    type = 'all',
    status = 'all',
    search = '',
  }) {
    try {
      // The wrapped builder is mutable: every chained call rewrites the
      // same statement text, so a count projection would clobber the
      // data projection on a shared instance. Route both queries
      // through one filter helper over independent builders instead.
      const applyFilters = (q: any): any => {
        if (connection !== 'all')
          q = q.where('connection', '=', connection)

        if (status !== 'all')
          q = q.where('status', '=', status as any)

        if (type !== 'all')
          q = q.where('tags', 'like', `%"${type}"%`)

        if (search) {
          // Parenthesized OR-group with bound parameters.
          q = q.whereAny(['query', 'model', 'method', 'affected_tables'], 'like', `%${search}%`)
        }

        return q
      }

      // Get total count for pagination
      const totalResult = await applyFilters(db.selectFrom('query_logs'))
        .select(db.fn.count('id').as('count'))
        .executeTakeFirstOrThrow()
      const total = Number(totalResult.count)

      // Apply pagination
      const offset = (page - 1) * perPage

      // Execute paginated query
      const results = await applyFilters(db.selectFrom('query_logs'))
        .select([
          'id',
          'query',
          'normalized_query',
          'duration',
          'connection',
          'status',
          'executed_at',
          'model',
          'method',
          'rows_affected',
          'tags',
        ])
        .orderBy('executed_at', 'desc')
        .limit(perPage)
        .offset(offset)
        .execute()

      return {
        data: results,
        meta: {
          current_page: page,
          per_page: perPage,
          total,
          last_page: Math.ceil(total / perPage),
        },
      }
    }
    catch (error: unknown) {
      const err = error as Error
      throw new Error(`Failed to fetch recent queries: ${err.message}`)
    }
  }

  /**
   * Get a list of slow queries
   */
  async getSlowQueries({
    page = 1,
    perPage = 10,
    threshold = 0,
    connection = 'all',
    search = '',
  }) {
    try {
      let slowThreshold = threshold
      if (slowThreshold < 0)
        slowThreshold = config.database?.queryLogging?.slowThreshold || 100

      // Mutable builder: see getRecentQueries for why count and data
      // queries are independent builders sharing one filter helper.
      const applyFilters = (q: any): any => {
        q = q.where('duration', '>=', slowThreshold)

        if (connection !== 'all')
          q = q.where('connection', '=', connection)

        if (search) {
          q = q.whereAny(['query', 'model', 'method', 'affected_tables'], 'like', `%${search}%`)
        }

        return q
      }

      const totalResult = await applyFilters(db.selectFrom('query_logs'))
        .select(db.fn.count('id').as('count'))
        .executeTakeFirstOrThrow()
      const total = Number(totalResult.count)

      const offset = (page - 1) * perPage

      const results = await applyFilters(db.selectFrom('query_logs'))
        .select([
          'id',
          'query',
          'normalized_query',
          'duration',
          'connection',
          'status',
          'executed_at',
          'model',
          'method',
          'rows_affected',
          'optimization_suggestions',
          'affected_tables',
          'indexes_used',
          'missing_indexes',
        ])
        .orderBy('duration', 'desc')
        .limit(perPage)
        .offset(offset)
        .execute()

      return {
        data: results,
        meta: {
          current_page: page,
          per_page: perPage,
          total,
          last_page: Math.ceil(total / perPage),
          threshold: slowThreshold,
        },
      }
    }
    catch (error: unknown) {
      const err = error as Error
      throw new Error(`Failed to fetch slow queries: ${err.message}`)
    }
  }

  /**
   * Get a single query by ID
   */
  async getQuery(id: number) {
    try {
      const query = await db
        .selectFrom('query_logs')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirst()

      if (!query)
        throw new Error('Query not found')

      // Parse JSON fields (safely — data may be corrupted)
      const safeParse = (val: string | null | undefined, fallback: any = []) => {
        if (!val) return fallback
        try { return JSON.parse(val) }
        catch { return fallback }
      }

      return {
        ...query,
        bindings: safeParse(query.bindings, null),
        tags: safeParse(query.tags),
        affected_tables: safeParse(query.affected_tables),
        indexes_used: safeParse(query.indexes_used),
        missing_indexes: safeParse(query.missing_indexes),
        optimization_suggestions: safeParse(query.optimization_suggestions),
      }
    }
    catch (error: any) {
      throw new Error(`Failed to fetch query: ${error.message}`)
    }
  }

  /**
   * Get query timeline data for charts
   */
  async getQueryTimeline({
    timeframe = 'day', // 'day', 'week', 'month'
    type = 'all',
  }) {
    try {
      let interval: string
      let timeConstraint: string

      // Set time grouping format and constraint based on timeframe
      switch (timeframe) {
        case 'week':
          interval = '%Y-%m-%d'
          timeConstraint = '-7 day'
          break
        case 'month':
          interval = '%Y-%m-%d'
          timeConstraint = '-30 day'
          break
        case 'day':
        default:
          interval = '%Y-%m-%d %H:00:00'
          timeConstraint = '-24 hour'
          break
      }

      let query = db
        .selectFrom('query_logs')
        .select([
          sql`strftime(${sql.literal(interval)}, executed_at)`.as('time_interval'),
          db.fn.count('id').as('count'),
          db.fn.avg('duration').as('avg_duration'),
        ])
        .whereRaw(sql`executed_at >= datetime("now", ${sql.literal(timeConstraint)})`)
        .groupBy('time_interval')
        .orderBy('time_interval')

      // Apply type filter if specified
      if (type !== 'all')
        query = query.where('tags', 'like', `%"${type}"%`)

      const results = await query.execute()

      return {
        data: results,
        meta: {
          timeframe,
          type,
        },
      }
    }
    catch (error: unknown) {
      const err = error as Error
      throw new Error(`Failed to fetch query timeline: ${err.message}`)
    }
  }

  /**
   * Get the most frequently run normalized queries
   */
  async getFrequentQueries(): Promise<Array<{
    normalized_query: string
    count: string | number | bigint
    avg_duration: string | number
    max_duration: number | undefined
  }>> {
    try {
      const results = await db
        .selectFrom('query_logs')
        .select([
          'normalized_query',
          db.fn.count('id').as('count'),
          db.fn.avg('duration').as('avg_duration'),
          db.fn.max('duration').as('max_duration'),
        ])
        .groupBy('normalized_query')
        .orderBy('count', 'desc')
        .limit(10)
        .execute()

      return results
    }
    catch (error: unknown) {
      const err = error as Error
      throw new Error(`Failed to fetch frequent queries: ${err.message}`)
    }
  }

  /**
   * Prune old query logs
   */
  async pruneQueryLogs() {
    try {
      const retentionDays = config.database?.queryLogging?.retention || 7

      // Parameterized via db.unsafe: the delete builder can neither
      // bind a datetime() expression nor render raw WHERE fragments.
      const statement = await (db as any).unsafe(
        `DELETE FROM query_logs WHERE executed_at < datetime("now", ?)`,
        [`-${retentionDays} day`],
      )
      const result = typeof statement?.execute === 'function' ? await statement.execute() : statement

      return {
        pruned: Number(result?.changes ?? result?.numDeletedRows ?? 0),
        retentionDays,
      }
    }
    catch (error: unknown) {
      const err = error as Error
      throw new Error(`Failed to prune query logs: ${err.message}`)
    }
  }
}
