import { config } from '@stacksjs/config'
import { db } from '@stacksjs/database'
import { Controller } from '@stacksjs/server'
import { sql } from 'kysely'

export default class QueryController extends Controller {
  /**
   * Get query statistics for the dashboard
   */
  static async getStats() {
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
        .where('executed_at', '>=', sql`datetime("now", "-1 day")` as any)
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
  static async getRecentQueries({
    page = 1,
    perPage = 10,
    connection = 'all',
    type = 'all',
    status = 'all',
    search = '',
  }) {
    try {
      let query = db
        .selectFrom('query_logs')
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

      // Apply filters
      if (connection !== 'all')
        query = query.where('connection', '=', connection)

      if (status !== 'all')
        query = query.where('status', '=', status as any)

      if (type !== 'all')
        query = query.where('tags', 'like', `%"${type}"%`)

      if (search) {
        query = query.where(eb => eb.or([
          eb('query', 'like', `%${search}%`),
          eb('model', 'like', `%${search}%`),
          eb('method', 'like', `%${search}%`),
          eb('affected_tables', 'like', `%${search}%`),
        ]))
      }

      // Get total count for pagination
      const countQuery = query.$call(q => q.select(db.fn.count('id').as('count')))
      const totalResult = await countQuery.executeTakeFirstOrThrow()
      const total = Number(totalResult.count)

      // Apply pagination
      const offset = (page - 1) * perPage
      query = query.limit(perPage).offset(offset)

      // Execute paginated query
      const results = await query.execute()

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
  static async getSlowQueries({
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

      let query = db
        .selectFrom('query_logs')
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
        .where('duration', '>=', slowThreshold)
        .orderBy('duration', 'desc')

      if (connection !== 'all')
        query = query.where('connection', '=', connection)

      if (search) {
        query = query.where(eb => eb.or([
          eb('query', 'like', `%${search}%`),
          eb('model', 'like', `%${search}%`),
          eb('method', 'like', `%${search}%`),
          eb('affected_tables', 'like', `%${search}%`),
        ]))
      }

      const countQuery = query.$call(q => q.select(db.fn.count('id').as('count')))
      const totalResult = await countQuery.executeTakeFirstOrThrow()
      const total = Number(totalResult.count)

      const offset = (page - 1) * perPage
      query = query.limit(perPage).offset(offset)

      const results = await query.execute()

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
  static async getQuery(id: number) {
    try {
      const query = await db
        .selectFrom('query_logs')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirst()

      if (!query)
        throw new Error('Query not found')

      // Parse JSON fields
      return {
        ...query,
        bindings: query.bindings ? JSON.parse(query.bindings) : null,
        tags: query.tags ? JSON.parse(query.tags) : [],
        affected_tables: query.affected_tables ? JSON.parse(query.affected_tables) : [],
        indexes_used: query.indexes_used ? JSON.parse(query.indexes_used) : [],
        missing_indexes: query.missing_indexes ? JSON.parse(query.missing_indexes) : [],
        optimization_suggestions: query.optimization_suggestions
          ? JSON.parse(query.optimization_suggestions)
          : [],
      }
    }
    catch (error: any) {
      throw new Error(`Failed to fetch query: ${error.message}`)
    }
  }

  /**
   * Get query timeline data for charts
   */
  static async getQueryTimeline({
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
          sql`strftime("${interval}", executed_at)`.as('time_interval'),
          db.fn.count('id').as('count'),
          db.fn.avg('duration').as('avg_duration'),
        ])
        .where('executed_at', '>=', sql`datetime("now", "${timeConstraint}")` as any)
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
  static async getFrequentQueries(): Promise<Array<{
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
  static async pruneQueryLogs() {
    try {
      const retentionDays = config.database?.queryLogging?.retention || 7

      const result = await db
        .deleteFrom('query_logs')
        .where('executed_at', '<', sql`datetime("now", "-${retentionDays} day")` as any)
        .executeTakeFirst()

      return {
        pruned: result.numDeletedRows,
        retentionDays,
      }
    }
    catch (error: unknown) {
      const err = error as Error
      throw new Error(`Failed to prune query logs: ${err.message}`)
    }
  }
}
