import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { NotificationDelivery } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'
import { dashboardRequestValue } from '../dashboard-request'
import { parseDeliveryMetadata } from './notification-delivery'

type DashboardDeliveryChannel = 'email' | 'sms'

function isDashboardChannel(value: string): value is DashboardDeliveryChannel {
  return value === 'email' || value === 'sms'
}

export function resolveDashboardDeliveryChannel(
  url: string,
  queryChannel?: string,
  routeChannel?: string,
): DashboardDeliveryChannel | null {
  const explicitChannel = String(queryChannel || routeChannel || '').toLowerCase()
  if (isDashboardChannel(explicitChannel))
    return explicitChannel

  const pathChannel = new URL(url, 'http://localhost').pathname.split('/').filter(Boolean).at(-1)?.toLowerCase() || ''
  return isDashboardChannel(pathChannel) ? pathChannel : null
}

export default new Action({
  name: 'Notification Delivery Index',
  description: 'Returns real email or SMS transport attempts for the dashboard.',
  method: 'GET',
  apiResponse: true,
  async handle(request: RequestInstance) {
    const channel = resolveDashboardDeliveryChannel(
      request.url,
      dashboardRequestValue(request, 'channel'),
    )
    if (!channel)
      return response.json({ message: 'Channel must be email or sms.' }, 422)

    try {
      const records = await NotificationDelivery
        .where('channel', '=', channel)
        .orderByDesc('sent_at')
        .orderByDesc('created_at')
        .limit(500)
        .get()
      const deliveries = records.map(record => ({
        id: Number(record.get('id')),
        user_id: record.get('user_id') ? Number(record.get('user_id')) : null,
        channel,
        recipient: String(record.get('recipient') || ''),
        subject: String(record.get('subject') || ''),
        body: String(record.get('body') || ''),
        status: String(record.get('status') || 'pending'),
        error: String(record.get('error') || ''),
        metadata: parseDeliveryMetadata(
          record.get('metadata'),
          `notification delivery ${record.get('id')} metadata`,
        ),
        sent_at: String(record.get('sent_at') || record.get('created_at') || ''),
        created_at: String(record.get('created_at') || ''),
      }))

      return response.json(deliveries)
    }
    catch (error) {
      return dashboardOperationalError(error, 'Notification deliveries could not be loaded.', 'NotificationDeliveryIndexAction')
    }
  },
})
