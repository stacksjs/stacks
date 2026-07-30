import { Action } from '@stacksjs/actions'
import { config } from '@stacksjs/config'
import { db } from '@stacksjs/database'
import { response } from '@stacksjs/router'
import { dashboardQueryColumns, mapDashboardQueryLog, type QueryLogSourceRow } from './query-dashboard'

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
        .select(dashboardQueryColumns)
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
      return response.json({
        message: error instanceof Error ? error.message : 'Query logs could not be loaded.',
      }, 503)
    }
  },
})
