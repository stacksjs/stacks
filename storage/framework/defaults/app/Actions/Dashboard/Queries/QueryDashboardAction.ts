import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { config } from '@stacksjs/config'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'
import { parseQueryListQuery, readQueryLogPage } from './query-list'

/**
 * `GET /api/dashboard/queries`: one page of the query log for the Queries
 * pages, with the counts their cards show. The range, filters and page are
 * read by the database (`query-list.ts`, stacksjs/stacks#3204).
 */
export default new Action({
  name: 'Query Dashboard',
  description: 'Returns safe, native query log records for the operator dashboard.',
  method: 'GET',
  apiResponse: true,

  async handle(request: RequestInstance) {
    const query = parseQueryListQuery(key => request.get<unknown>(key, ''))
    if ('error' in query)
      return response.json({ message: query.error }, 422)

    const queryLogging = config.database?.queryLogging
    try {
      const result = await readQueryLogPage(query)

      return {
        enabled: queryLogging?.enabled === true,
        slowThreshold: queryLogging?.slowThreshold || 100,
        queries: result.rows,
        total: result.counts.total,
        page: result.page,
        perPage: query.perPage,
        counts: result.counts,
        connections: result.connections,
      }
    }
    catch (error) {
      return dashboardOperationalError(error, 'Query logs could not be loaded.', 'QueryDashboardAction')
    }
  },
})
