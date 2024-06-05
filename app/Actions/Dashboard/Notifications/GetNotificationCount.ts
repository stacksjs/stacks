import { Action } from '@stacksjs/actions'
// import { Notification } from '@stacksjs/orm'

export default new Action({
  name: 'GetNotificationCount',
  description: 'Gets the total number of notifications.',
  apiResponse: true,

  async handle() {
    // return Notification.count()
  },
})
