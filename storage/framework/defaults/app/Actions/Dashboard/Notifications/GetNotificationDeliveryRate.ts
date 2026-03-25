import { Action } from '@stacksjs/actions'
// import { Notification } from '@stacksjs/orm'

export default new Action({
  name: 'GetNotificationDeliveryRate',
  description: 'Gets the notification delivery rate of your application.',
  apiResponse: true,

  async handle() {
    // return Notification.deliveryRate()
  },
})
