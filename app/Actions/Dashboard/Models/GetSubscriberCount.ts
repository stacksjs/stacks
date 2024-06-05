import { Action } from '@stacksjs/actions'
// import { Subscriber } from '@stacksjs/orm'

export default new Action({
  name: 'GetSubscriberCount',
  description: 'Gets the total number of subscribers.',
  apiResponse: true,

  async handle() {
    // return Subscriber.count()
  },
})
