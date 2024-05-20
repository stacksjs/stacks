import { Action } from '@stacksjs/actions'
// import { Notification } from '@stacksjs/orm'

export default new Action({
  name: 'GetNotifications',
  description: 'Gets your notifications.',
  apiResponse: true,

  async handle() {
    // return Notification.all()
  },
})
