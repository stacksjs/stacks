import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'
import {
  normalizeAnalyticsRange,
  normalizeAnalyticsScope,
} from './request-analytics'
import { readDashboardWebAnalytics } from './web-analytics-provider'

export default new Action({
  name: 'WebAnalyticsAction',
  description: 'Returns privacy-safe web traffic aggregates from recorded application requests.',
  method: 'GET',
  apiResponse: true,

  async handle(request: RequestInstance) {
    let range
    let scope
    try {
      range = normalizeAnalyticsRange(request.get('range'))
      scope = normalizeAnalyticsScope(request.get('scope'))
    }
    catch (error) {
      return response.json({
        message: error instanceof Error ? error.message : 'The analytics query is invalid.',
      }, 422)
    }
    try {
      return await readDashboardWebAnalytics({ range, scope })
    }
    catch (error) {
      return dashboardOperationalError(error, 'Web analytics records could not be read.', 'WebAnalyticsAction')
    }
  },
})
