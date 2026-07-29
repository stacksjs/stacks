import { Action } from '@stacksjs/actions'
import { config } from '@stacksjs/config'
import { db } from '@stacksjs/database'
import { mapDashboardQueryLog, type QueryLogSourceRow } from './query-dashboard'

export default new Action({
  name: 'Query Dashboard',
  description: 'Returns safe, native query log records for the operator dashboard.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    const queryLogging = config.database?.queryLogging
    try {
      const rows = await db
        .selectFrom('query_logs')
        .select([
          'id',
          'query',
          'normalized_query',
          'duration',
          'connection',
          'status',
          'error',
          'executed_at',
          'model',
          'method',
          'rows_affected',
          'memory_usage',
          'tags',
          'affected_tables',
          'indexes_used',
          'missing_indexes',
          'optimization_suggestions',
        ])
        .orderBy('executed_at', 'desc')
        .limit(2000)
        .execute()

      return {
        enabled: queryLogging?.enabled === true,
        slowThreshold: queryLogging?.slowThreshold || 100,
        queries: rows.map(row => mapDashboardQueryLog(row as QueryLogSourceRow)),
      }
    }
    catch (error) {
      return {
        enabled: queryLogging?.enabled === true,
        slowThreshold: queryLogging?.slowThreshold || 100,
        queries: [],
        error: error instanceof Error ? error.message : 'Query logs could not be loaded.',
      }
    }
  },
})
