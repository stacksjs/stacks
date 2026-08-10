import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'
import { dashboardRequestValue } from '../dashboard-request'
import {
  type NotificationDeliveryRow,
  serializeNotificationDelivery,
} from './notification-delivery'

const CHANNELS = ['email', 'sms', 'chat', 'database', 'push', 'broadcast'] as const
const STATUSES = ['sent', 'delivered', 'failed', 'pending'] as const
const SORTS = ['sent_at', 'recipient', 'channel', 'status', 'id'] as const

type DeliveryChannel = typeof CHANNELS[number]
type DeliveryStatus = typeof STATUSES[number]
type DeliverySort = typeof SORTS[number]

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
    const channel = allowedValue(queryValue(request, 'channel').toLowerCase(), CHANNELS)
    const status = allowedValue(queryValue(request, 'status').toLowerCase(), STATUSES)
    const sort = allowedValue(queryValue(request, 'sort').toLowerCase(), SORTS) || 'sent_at'
    const direction = queryValue(request, 'direction').toLowerCase() === 'asc' ? 'asc' : 'desc'
    const search = queryValue(request, 'search')
    if (search.length > 200)
      return response.json({ message: 'Notification delivery search must be 200 characters or fewer.' }, 422)
    const searchPattern = `%${search}%`

    const applyFilters = <T extends {
      where: (...args: any[]) => T
    }>(query: T): T => {
      let filtered = query
      if (channel)
        filtered = filtered.where('channel', '=', channel)
      if (status)
        filtered = filtered.where('status', '=', status)
      if (search) {
        filtered = filtered.where((expression: any) => expression.or([
          expression('recipient', 'like', searchPattern),
          expression('subject', 'like', searchPattern),
          expression('body', 'like', searchPattern),
          expression('error', 'like', searchPattern),
        ]))
      }
      return filtered
    }

    try {
      const countQuery = applyFilters(
        db
          .selectFrom('notification_deliveries')
          .select(db.fn.count('id').as('count')),
      )
      const rowsQuery = applyFilters(
        db
          .selectFrom('notification_deliveries')
          .selectAll(),
      )

      const [countRow, rows] = await Promise.all([
        countQuery.executeTakeFirst() as Promise<{ count: number | string } | undefined>,
        rowsQuery
          .orderBy(sort as DeliverySort, direction)
          .limit(perPage)
          .offset((page - 1) * perPage)
          .execute() as Promise<NotificationDeliveryRow[]>,
      ])

      const total = Number(countRow?.count || 0)
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
          channel: channel as DeliveryChannel | null,
          status: status as DeliveryStatus | null,
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
