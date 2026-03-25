import { Action } from '@stacksjs/actions'
// import { Notification } from '@stacksjs/orm'

export default new Action({
  name: 'GetAverageNotificationTime',
  description: 'Gets the average notification time of your application.',
  apiResponse: true,

  async handle() {
    // return Notification.averageDuration()
  },
})
