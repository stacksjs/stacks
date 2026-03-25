import { Action } from '@stacksjs/actions'
import { Notification } from '@stacksjs/orm'

export default new Action({
  name: 'GetNotifications',
  description: 'Gets your notifications.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    const items = await Notification.orderBy('created_at', 'desc').limit(50).get()

    return {
      notifications: items.map(i => i.toJSON()),
    }
  },
})
