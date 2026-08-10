import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { AnalyticsEvent } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'
import {
  analyticsCurrency,
  analyticsIdentifier,
  analyticsNumber,
  analyticsOptionalString,
  analyticsString,
  analyticsTimestamp,
} from './analytics-record'
import { buildEventAnalytics } from './event-analytics'
import { normalizeAnalyticsRange } from './request-analytics'

export default new Action({
  name: 'EventAnalyticsAction',
  description: 'Returns privacy-safe aggregates from AnalyticsEvent records.',
  method: 'GET',
  apiResponse: true,

  async handle(request: RequestInstance) {
    let range
    try {
      range = normalizeAnalyticsRange(request.get('range'))
    }
    catch (error) {
      return response.json({
        message: error instanceof Error ? error.message : 'The analytics query is invalid.',
      }, 422)
    }
    try {
      const events = await AnalyticsEvent.orderByDesc('id').limit(20_000).get()

      return buildEventAnalytics(
        events.map((event) => {
          const id = analyticsIdentifier(event.get('id'), 'AnalyticsEvent')
          const source = `AnalyticsEvent ${id}`
          return {
            id,
            name: analyticsString(event.get('name'), source, 'name'),
            category: analyticsString(event.get('category'), source, 'category'),
            path: analyticsOptionalString(event.get('path'), source, 'path'),
            value: analyticsNumber(event.get('value'), source, 'value', { min: 0 }),
            currency: analyticsCurrency(event.get('currency'), source),
            createdAt: analyticsTimestamp(event.get('created_at'), source),
          }
        }),
        range,
      )
    }
    catch (error) {
      return dashboardOperationalError(error, 'Event analytics records could not be read.', 'EventAnalyticsAction')
    }
  },
})
