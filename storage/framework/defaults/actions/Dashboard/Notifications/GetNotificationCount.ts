import { Action } from '@stacksjs/actions'
import { Notification } from '@stacksjs/orm'

export default new Action({
  name: 'GetNotificationCount',
  description: 'Gets the total number of notifications.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    const count = await Notification.count()
    return { count }
  },
})
