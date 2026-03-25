import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'CreateNotification',
  description: 'Creates a new notification.',
  method: 'POST',
  apiResponse: true,

  async handle() {
    // TODO: replace with Notification.create() when available
  },
})
