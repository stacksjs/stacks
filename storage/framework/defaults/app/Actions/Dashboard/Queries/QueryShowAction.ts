import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'
import { dashboardQueryColumns, mapDashboardQueryLog, type QueryLogSourceRow } from './query-dashboard'

export default new Action({
  name: 'Query Details',
  description: 'Returns one safe query-log projection for the operator dashboard.',
  method: 'GET',
  apiResponse: true,

  async handle(request: RequestInstance) {
    const id = Number(request.getParam('id'))
    if (!Number.isInteger(id) || id <= 0)
      return { query: null }

    try {
      const row = await db
        .selectFrom('query_logs')
        .select(dashboardQueryColumns)
        .where('id', '=', id)
        .executeTakeFirst()

      return {
        query: row ? mapDashboardQueryLog(row as QueryLogSourceRow) : null,
      }
    }
    catch {
      return { query: null }
    }
  },
})
