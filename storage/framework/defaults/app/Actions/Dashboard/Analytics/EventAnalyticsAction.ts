import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { AnalyticsEvent } from '@stacksjs/orm'
import { buildEventAnalytics } from './event-analytics'
import { normalizeAnalyticsRange } from './request-analytics'

export default new Action({
  name: 'EventAnalyticsAction',
  description: 'Returns privacy-safe aggregates from AnalyticsEvent records.',
  method: 'GET',
  apiResponse: true,

  async handle(request: RequestInstance) {
    const range = normalizeAnalyticsRange(request.get('range'))
    const events = await AnalyticsEvent.orderByDesc('id').limit(20_000).get()

    return buildEventAnalytics(
      events.map(event => ({
        id: String(event.get('id') || ''),
        name: String(event.get('name') || ''),
        category: String(event.get('category') || 'custom'),
        path: String(event.get('path') || ''),
        value: Number(event.get('value') || 0),
        currency: String(event.get('currency') || 'USD'),
        createdAt: String(event.get('created_at') || ''),
      })),
      range,
    )
  },
})
