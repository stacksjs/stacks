import { Action } from '@stacksjs/actions'
// import { Notification } from '@stacksjs/orm'

export default new Action({
  name: 'GetNotifications',
  description: 'Gets your jobs.',
  apiResponse: true,

  async handle() {
    // wip: needs to return the jobs from ./app/Notifications/
  },
})
