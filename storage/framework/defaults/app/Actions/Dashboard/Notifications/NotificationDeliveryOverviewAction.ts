import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'
import {
  type NotificationDeliveryRow,
  serializeNotificationDelivery,
} from './notification-delivery'

interface CountRow {
  count: number | string
}

interface StatusCountRow extends CountRow {
  status: string
}

interface ChannelStatusCountRow extends StatusCountRow {
  channel: string
}

const DELIVERY_STATUSES = ['sent', 'delivered', 'failed', 'pending'] as const

function numericCount(value: number | string | undefined): number {
  const count = Number(value || 0)
  if (!Number.isSafeInteger(count) || count < 0)
    throw new TypeError('Notification delivery count must be a non-negative integer.')
  return count
}

async function notificationDeliveryOverview() {
  const [totalRow, statusRows, channelRows, recentRows] = await Promise.all([
    db
      .selectFrom('notification_deliveries')
      .select(db.fn.count('id').as('count'))
      .executeTakeFirst() as Promise<CountRow | undefined>,
    db
      .selectFrom('notification_deliveries')
      .select(['status', db.fn.count('id').as('count')])
      .groupBy('status')
      .execute() as Promise<StatusCountRow[]>,
    db
      .selectFrom('notification_deliveries')
      .select(['channel', 'status', db.fn.count('id').as('count')])
      .groupBy(['channel', 'status'])
      .execute() as Promise<ChannelStatusCountRow[]>,
    db
      .selectFrom('notification_deliveries')
      .selectAll()
      .orderBy('sent_at', 'desc')
      .limit(8)
      .execute() as Promise<NotificationDeliveryRow[]>,
  ])

  const statuses = Object.fromEntries(
    DELIVERY_STATUSES.map(status => [status, 0]),
  ) as Record<typeof DELIVERY_STATUSES[number], number>

  for (const row of statusRows) {
    if (DELIVERY_STATUSES.includes(row.status as typeof DELIVERY_STATUSES[number]))
      statuses[row.status as typeof DELIVERY_STATUSES[number]] = numericCount(row.count)
  }

  const channelMap = new Map<string, {
    channel: string
    total: number
    sent: number
    delivered: number
    failed: number
    pending: number
  }>()

  for (const row of channelRows) {
    const channel = String(row.channel || 'unknown')
    const entry = channelMap.get(channel) || {
      channel,
      total: 0,
      sent: 0,
      delivered: 0,
      failed: 0,
      pending: 0,
    }
    const count = numericCount(row.count)
    entry.total += count
    if (DELIVERY_STATUSES.includes(row.status as typeof DELIVERY_STATUSES[number]))
      entry[row.status as typeof DELIVERY_STATUSES[number]] += count
    channelMap.set(channel, entry)
  }

  const channels = [...channelMap.values()]
    .map(channel => ({
      ...channel,
      success_rate: channel.total > 0
        ? Number((((channel.sent + channel.delivered) / channel.total) * 100).toFixed(1))
        : 0,
    }))
    .sort((a, b) => b.total - a.total || a.channel.localeCompare(b.channel))

  const total = numericCount(totalRow?.count)
  const successful = statuses.sent + statuses.delivered

  return {
    stats: {
      total,
      successful,
      failed: statuses.failed,
      pending: statuses.pending,
      success_rate: total > 0
        ? Number(((successful / total) * 100).toFixed(1))
        : 0,
      active_channels: channels.length,
    },
    statuses,
    channels,
    recent: recentRows.map(serializeNotificationDelivery),
  }
}

export default new Action({
  name: 'Notification Delivery Overview',
  description: 'Returns aggregate transport health and recent notification delivery attempts.',
  method: 'GET',
  apiResponse: true,
  async handle() {
    try {
      return response.json(await notificationDeliveryOverview())
    }
    catch (error) {
      return dashboardOperationalError(error, 'Notification delivery overview could not be loaded.', 'NotificationDeliveryOverviewAction')
    }
  },
})
