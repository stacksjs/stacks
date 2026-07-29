import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { NotificationDelivery } from '@stacksjs/orm'
import { request as routerRequest, response } from '@stacksjs/router'

type DashboardDeliveryChannel = 'email' | 'sms'

interface DeliveryMetadata {
  [key: string]: unknown
}

function parseMetadata(value: unknown): DeliveryMetadata {
  if (typeof value !== 'string' || !value)
    return {}

  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? parsed as DeliveryMetadata : {}
  }
  catch {
    return {}
  }
}

function isDashboardChannel(value: string): value is DashboardDeliveryChannel {
  return value === 'email' || value === 'sms'
}

export default new Action({
  name: 'Notification Delivery Index',
  description: 'Returns real email or SMS transport attempts for the dashboard.',
  method: 'GET',
  apiResponse: true,
  async handle(request: RequestInstance) {
    const query = ((routerRequest as any).query || {}) as Record<string, string | string[] | undefined>
    const queryChannel = Array.isArray(query.channel) ? query.channel[0] : query.channel
    const channel = String(queryChannel || request.get('channel') || '').toLowerCase()
    if (!isDashboardChannel(channel))
      return response.json({ message: 'Channel must be email or sms.' }, 422)

    const records = await NotificationDelivery.where('channel', '=', channel).get()
    const deliveries = records
      .map(record => ({
        id: Number(record.get('id')),
        user_id: record.get('user_id') ? Number(record.get('user_id')) : null,
        channel,
        recipient: String(record.get('recipient') || ''),
        subject: String(record.get('subject') || ''),
        body: String(record.get('body') || ''),
        status: String(record.get('status') || 'pending'),
        error: String(record.get('error') || ''),
        metadata: parseMetadata(record.get('metadata')),
        sent_at: String(record.get('sent_at') || record.get('created_at') || ''),
        created_at: String(record.get('created_at') || ''),
      }))
      .sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime())
      .slice(0, 500)

    return response.json(deliveries)
  },
})
