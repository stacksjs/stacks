import type { RequestInstance } from '@stacksjs/types'
import type { DashboardLogQuery, DashboardLogRange } from './log-provider'
import { Action } from '@stacksjs/actions'
import { dashboardRequestValue } from '../dashboard-request'
import { dashboardOperationalError } from '../dashboard-response'
import { DASHBOARD_LOG_TYPES } from './log-dashboard'
import { DASHBOARD_LOG_RANGES, readDashboardLogs } from './log-provider'

function queryValue(request: RequestInstance, key: string): string {
  return dashboardRequestValue(request, key)
}

/** Reads the filters off the request. Unknown values fall back rather than fail. */
function logQuery(request: RequestInstance): DashboardLogQuery {
  const requestedType = queryValue(request, 'type').toLowerCase()
  const requestedRange = queryValue(request, 'range').toLowerCase()

  return {
    page: Math.max(1, Number.parseInt(queryValue(request, 'page') || '1', 10) || 1),
    perPage: Math.min(100, Math.max(10, Number.parseInt(queryValue(request, 'per_page') || '25', 10) || 25)),
    search: queryValue(request, 'search'),
    type: DASHBOARD_LOG_TYPES.includes(requestedType as typeof DASHBOARD_LOG_TYPES[number])
      ? requestedType
      : '',
    source: queryValue(request, 'source').toLowerCase(),
    project: queryValue(request, 'project'),
    range: DASHBOARD_LOG_RANGES.includes(requestedRange as DashboardLogRange)
      ? requestedRange as DashboardLogRange
      : '30',
  }
}

export default new Action({
  name: 'LogIndexAction',
  description: 'Returns filtered, paginated Log model records for the dashboard.',
  method: 'GET',
  apiResponse: true,

  async handle(request: RequestInstance) {
    try {
      return await readDashboardLogs(logQuery(request))
    }
    catch (error) {
      return dashboardOperationalError(error, 'Logs could not be loaded.', 'LogIndexAction')
    }
  },
})
