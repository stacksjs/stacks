import { Action } from '@stacksjs/actions'
import { Subscriber } from '@stacksjs/orm'

export default new Action({
  name: 'GetSubscriberCount',
  description: 'Gets the total number of subscribers.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    const count = await Subscriber.count()
    return { count }
  },
})
