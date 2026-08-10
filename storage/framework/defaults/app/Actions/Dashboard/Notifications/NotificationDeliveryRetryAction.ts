import type { NotificationChannel } from '@stacksjs/notifications'
import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { notify } from '@stacksjs/notifications'
import { NotificationDelivery } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'
import { parseDeliveryMetadata } from './notification-delivery'

type RetryChannel = 'email' | 'sms'

function isRetryChannel(value: string): value is RetryChannel {
  return value === 'email' || value === 'sms'
}

export default new Action({
  name: 'Retry Notification Delivery',
  description: 'Retries a failed email or SMS notification using its stored payload.',
  method: 'POST',
  apiResponse: true,
  async handle(request: RequestInstance) {
    const id = Number(request.getParam('id'))
    if (!Number.isSafeInteger(id) || id <= 0)
      return response.json({ message: 'A valid delivery ID is required.' }, 400)

    let delivery: Awaited<ReturnType<typeof NotificationDelivery.find>>
    try {
      delivery = await NotificationDelivery.find(id)
    }
    catch (error) {
      return dashboardOperationalError(error, 'Notification delivery could not be loaded.', 'NotificationDeliveryRetryAction.lookup')
    }
    if (!delivery)
      return response.json({ message: 'Notification delivery not found.' }, 404)

    const channel = String(delivery.get('channel') || '').toLowerCase()
    if (!isRetryChannel(channel))
      return response.json({ message: 'Only email and SMS deliveries can be retried here.' }, 422)

    const recipientValue = String(delivery.get('recipient') || '')
    if (!recipientValue)
      return response.json({ message: 'The original delivery has no recipient.' }, 422)

    let results: Awaited<ReturnType<typeof notify>>
    try {
      const channels: NotificationChannel[] = [channel]
      results = await notify(
        {
          userId: delivery.get('user_id') ? Number(delivery.get('user_id')) : undefined,
          ...(channel === 'email' ? { email: recipientValue } : { phone: recipientValue }),
        },
        {
          subject: String(delivery.get('subject') || ''),
          body: String(delivery.get('body') || ''),
          data: parseDeliveryMetadata(
            delivery.get('metadata'),
            `notification delivery ${id} metadata`,
          ),
        },
        channels,
        { ignorePreferences: true },
      )
    }
    catch (error) {
      return dashboardOperationalError(error, 'The notification retry could not be completed.', 'NotificationDeliveryRetryAction.provider', 502)
    }

    const result = results[0]
    if (!result?.success)
      return dashboardOperationalError(result?.error, 'The notification retry failed.', 'NotificationDeliveryRetryAction.result', 502)

    return response.json({ success: true })
  },
})
