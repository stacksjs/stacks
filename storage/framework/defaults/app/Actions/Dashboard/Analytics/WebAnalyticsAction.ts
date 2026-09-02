import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { Request } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'
import {
  buildWebAnalytics,
  normalizeAnalyticsRange,
  normalizeAnalyticsScope,
  requestAnalyticsRow,
} from './request-analytics'

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
      const records = await Request.orderByDesc('id').limit(10_000).get()
      const rows = records.map(requestAnalyticsRow)

      return buildWebAnalytics(rows, range, new Date(), scope)
    }
    catch (error) {
      return dashboardOperationalError(error, 'Web analytics records could not be read.', 'WebAnalyticsAction')
    }
  },
})
