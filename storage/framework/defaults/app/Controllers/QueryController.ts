import { config } from '@stacksjs/config'
import { db, mutationCount, sql, sqlDateTime } from '@stacksjs/database/runtime'
import { Controller } from '@stacksjs/server/controllers/base'

const DAY_MS = 86_400_000
/** `2026-09-10T11` - the stored timestamp truncated to its hour. */
const HOUR_PREFIX = 13
/** `2026-09-10` - truncated to its day. */
const DAY_PREFIX = 10

/**
 * The hour bucket as the dashboard reads it: `2026-09-10 11:00:00`.
 *
 * Buckets are prefixes of the stored timestamp rather than the output of a
 * date function, because `strftime` and `datetime` exist only on SQLite. The
 * stored format is fixed (see `sqlDateTime`), so a prefix is exact, and the
 * label is restored here rather than in SQL.
 */
function hourLabel(bucket: string): string {
  return `${String(bucket).replace('T', ' ')}:00:00`
}

/**
 * The query type is the first element of the JSON array in `tags`, written by
 * the query logger. Read here rather than in SQL: the JSON functions differ
 * per dialect and PostgreSQL has none by these names.
 */
function queryTypeFromTags(tags: string | null | undefined): string {
  if (!tags)
    return 'unknown'
  try {
    const parsed = JSON.parse(tags) as unknown
    const first = Array.isArray(parsed) ? parsed[0] : undefined
    return typeof first === 'string' && first ? first : 'unknown'
  }
  catch {
    return 'unknown'
  }
}

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

      // `tags` is a string column holding a JSON array whose first element is
      // the query type. Grouping by the whole column keeps this portable:
      // `json_extract` is SQLite and MySQL only, and PostgreSQL has no such
      // function, so the previous projection made this endpoint fail there.
      // The distinct tag sets are few, so folding them by type here is cheap.
      const tagStats = await db
        .selectFrom('query_logs')
        .select([
          'tags',
          db.fn.count('id').as('count'),
          db.fn.avg('duration').as('avg_duration'),
        ])
        .groupBy('tags')
        .execute() as Array<{ tags: string | null, count: number | string, avg_duration: number | string | null }>

      const byType = new Map<string, { count: number, durationTotal: number }>()
      for (const row of tagStats) {
        const type = queryTypeFromTags(row.tags)
        const count = Number(row.count) || 0
        const entry = byType.get(type) ?? { count: 0, durationTotal: 0 }
        entry.count += count
        entry.durationTotal += Number(row.avg_duration ?? 0) * count
        byType.set(type, entry)
      }

      // Get counts by status
      const statusStats = await db
        .selectFrom('query_logs')
        .select(['status', db.fn.count('id').as('count')])
        .groupBy('status')
        .execute()

      // Get count of slow queries over time (last 24 hours)
      const slowQueriesTimeline = await db
        .selectFrom('query_logs')
        .select([
          sql`substr(executed_at, 1, 13)`.as('hour'),
          db.fn.count('id').as('count'),
        ])
        .where('status', '=', 'slow')
        .where('executed_at', '>=', sqlDateTime(new Date(Date.now() - 86_400_000)))
        .groupBy('hour')
        .orderBy('hour')
        .execute() as Array<{ hour: string, count: number | string }>

      return {
        totalQueries: totalQueries.count,
        byType: [...byType].map(([type, entry]) => ({ type, count: entry.count })),
        byStatus: statusStats,
        avgDuration: [...byType].map(([type, entry]) => ({
          type,
          avg_duration: entry.count === 0 ? 0 : entry.durationTotal / entry.count,
        })),
        slowQueriesTimeline: slowQueriesTimeline.map(row => ({
          hour: hourLabel(row.hour),
          count: Number(row.count) || 0,
        })),
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
      /*
       * The row's fields arrive `unknown` - the query builder has no schema for
       * this table - so this takes what it is given and decides. Reading a JSON
       * column is exactly the place a value has to be checked rather than
       * trusted: it is text somebody else wrote.
       */
      const safeParse = (val: unknown, fallback: unknown = []): unknown => {
        if (typeof val !== 'string' || !val)
          return fallback
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
      let bucketWidth: number
      let windowMs: number

      // Set the bucket width and how far back to look, per timeframe.
      switch (timeframe) {
        case 'week':
          bucketWidth = DAY_PREFIX
          windowMs = 7 * DAY_MS
          break
        case 'month':
          bucketWidth = DAY_PREFIX
          windowMs = 30 * DAY_MS
          break
        case 'day':
        default:
          bucketWidth = HOUR_PREFIX
          windowMs = DAY_MS
          break
      }

      let query = db
        .selectFrom('query_logs')
        .select([
          // Timestamps are stored in one canonical format, so the bucket is a
          // prefix of the stored text: 13 characters for an hour, 10 for a
          // day. `strftime` and `datetime` are SQLite-only, and the value in
          // `sql`...`` was interpolated as a quoted `'${interval}'`, which the
          // tag rendered as a literal `'?'`, so this returned nothing at all,
          // on every dialect.
          // Two fixed fragments rather than one interpolated width: a value
          // inside the tag is bound as a parameter, and a parameter here
          // throws the builder's own count off.
          (bucketWidth === HOUR_PREFIX ? sql`substr(executed_at, 1, 13)` : sql`substr(executed_at, 1, 10)`).as('time_interval'),
          db.fn.count('id').as('count'),
          db.fn.avg('duration').as('avg_duration'),
        ])
        .where('executed_at', '>=', sqlDateTime(new Date(Date.now() - windowMs)))
        .groupBy('time_interval')
        .orderBy('time_interval')

      // Apply type filter if specified
      if (type !== 'all')
        query = query.where('tags', 'like', `%"${type}"%`)

      const results = await query.execute() as Array<{ time_interval: string, count: number | string, avg_duration: number | string | null }>

      return {
        data: results.map(row => ({
          ...row,
          time_interval: bucketWidth === HOUR_PREFIX ? hourLabel(row.time_interval) : row.time_interval,
        })),
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

      /*
       * An aggregate select's rows are named by its aliases rather than by the
       * table, so they arrive unknown-valued. Read out here, once, rather than
       * asserted: `count` really can be a string, a number or a bigint
       * depending on the driver, which is why the return type says so.
       */
      /*
       * Annotated rather than inferred.
       *
       * `results` comes back from an aggregate select, whose rows are named by
       * their aliases rather than by the table, so each row is
       * `Record<string, unknown>` - and the mapped literal collapses to the
       * same thing rather than to the shape this method promises. Naming the
       * element type is what makes the compiler check the mapping against the
       * signature instead of widening past it.
       */
      return results.map((row): {
        normalized_query: string
        count: string | number | bigint
        avg_duration: string | number
        max_duration: number | undefined
      } => ({
        normalized_query: String(row.normalized_query ?? ''),
        count: (typeof row.count === 'number' || typeof row.count === 'bigint' ? row.count : String(row.count ?? '0')),
        avg_duration: (typeof row.avg_duration === 'number' ? row.avg_duration : String(row.avg_duration ?? '0')),
        max_duration: typeof row.max_duration === 'number' ? row.max_duration : undefined,
      }))
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

      // The cutoff is computed here rather than in SQL. `datetime("now", ?)`
      // is SQLite syntax, so this statement was a syntax error on PostgreSQL
      // and MySQL and pruned nothing there. It was not right on SQLite either:
      // `datetime()` renders `2026-09-10 11:00:00` while the logger writes
      // `sqlDateTime()`'s `2026-09-10T11:00:00.000`, and comparing those as
      // text keeps rows up to a day past their retention, because 'T' > ' '.
      // A bound cutoff in the stored format compares correctly everywhere.
      const cutoff = sqlDateTime(new Date(Date.now() - retentionDays * 86_400_000))
      const result = await db
        .deleteFrom('query_logs')
        .where('executed_at', '<', cutoff)
        .executeTakeFirst()

      return {
        // Each driver names the affected-row count differently, and the pair
        // read here covered only SQLite.
        pruned: mutationCount(result),
        retentionDays,
      }
    }
    catch (error: unknown) {
      const err = error as Error
      throw new Error(`Failed to prune query logs: ${err.message}`)
    }
  }
}
