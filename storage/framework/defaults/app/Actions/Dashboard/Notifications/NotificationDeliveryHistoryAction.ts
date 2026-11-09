import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'
import { dashboardRequestValue } from '../dashboard-request'
import { serializeNotificationDelivery } from './notification-delivery'
import {
  DELIVERY_CHANNELS,
  DELIVERY_SORTS,
  DELIVERY_STATUSES,
  readDeliveryHistory,
} from './notification-delivery-history'

function queryValue(request: RequestInstance, key: string): string {
  return dashboardRequestValue(request, key)
}

function allowedValue<T extends string>(value: string, values: readonly T[]): T | null {
  return values.includes(value as T) ? value as T : null
}

export default new Action({
  name: 'Notification Delivery History',
  description: 'Returns filtered, sorted, paginated notification transport history.',
  method: 'GET',
  apiResponse: true,
  async handle(request: RequestInstance) {
    const page = Math.min(1_000_000, Math.max(1, Number.parseInt(queryValue(request, 'page') || '1', 10) || 1))
    const perPage = Math.min(100, Math.max(1, Number.parseInt(queryValue(request, 'per_page') || '20', 10) || 20))
    const channel = allowedValue(queryValue(request, 'channel').toLowerCase(), DELIVERY_CHANNELS)
    const status = allowedValue(queryValue(request, 'status').toLowerCase(), DELIVERY_STATUSES)
    const sort = allowedValue(queryValue(request, 'sort').toLowerCase(), DELIVERY_SORTS) || 'sent_at'
    const direction = queryValue(request, 'direction').toLowerCase() === 'asc' ? 'asc' : 'desc'
    const search = queryValue(request, 'search')
    if (search.length > 200)
      return response.json({ message: 'Notification delivery search must be 200 characters or fewer.' }, 422)

    try {
      const { rows, total: counted } = await readDeliveryHistory({ page, perPage, channel, status, search, sort, direction })
      const total = Number(counted || 0)
      if (!Number.isSafeInteger(total) || total < 0)
        throw new TypeError('Notification delivery count must be a non-negative integer.')
      return response.json({
        deliveries: rows.map(serializeNotificationDelivery),
        pagination: {
          page,
          per_page: perPage,
          total,
          total_pages: Math.max(1, Math.ceil(total / perPage)),
        },
        filters: {
          channel,
          status,
          search,
          sort,
          direction,
        },
      })
    }
    catch (error) {
      return dashboardOperationalError(error, 'Notification delivery history could not be loaded.', 'NotificationDeliveryHistoryAction')
    }
  },
})
