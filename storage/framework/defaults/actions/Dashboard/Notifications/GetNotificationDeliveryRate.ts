import { Action } from '@stacksjs/actions'
import { Notification } from '@stacksjs/orm'

export default new Action({
  name: 'GetNotificationDeliveryRate',
  description: 'Gets the notification delivery rate of your application.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    const count = await Notification.count()

    return {
      deliveryRate: '-',
      totalNotifications: count,
    }
  },
})
