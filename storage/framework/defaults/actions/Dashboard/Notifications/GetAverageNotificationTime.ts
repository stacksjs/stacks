import { Action } from '@stacksjs/actions'
import { Notification } from '@stacksjs/orm'

export default new Action({
  name: 'GetAverageNotificationTime',
  description: 'Gets the average notification time of your application.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    const count = await Notification.count()

    return {
      averageNotificationTime: '-',
      totalNotifications: count,
    }
  },
})
