import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'
import { response } from '@stacksjs/router'
import { dashboardQueryColumns, mapDashboardQueryLog, type QueryLogSourceRow } from './query-dashboard'

export default new Action({
  name: 'Query Details',
  description: 'Returns one safe query-log projection for the operator dashboard.',
  method: 'GET',
  apiResponse: true,

  async handle(request: RequestInstance) {
    const id = Number(request.getParam('id'))
    if (!Number.isInteger(id) || id <= 0)
      return response.json({ message: 'Query id must be a positive integer.' }, 422)

    try {
      const row = await db
        .selectFrom('query_logs')
        .select(dashboardQueryColumns)
        .where('id', '=', id)
        .executeTakeFirst()

      if (!row)
        return response.json({ message: 'Query log not found.' }, 404)

      return { query: mapDashboardQueryLog(row as QueryLogSourceRow) }
    }
    catch (error) {
      return response.json({
        message: error instanceof Error ? error.message : 'Query log could not be loaded.',
      }, 503)
    }
  },
})
