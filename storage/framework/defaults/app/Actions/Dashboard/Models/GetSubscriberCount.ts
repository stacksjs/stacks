import { Action } from '@stacksjs/actions'
import { Subscriber } from '@stacksjs/orm'
import { dashboardOperationalError } from '../dashboard-response'

export default new Action({
  name: 'GetSubscriberCount',
  description: 'Gets the total number of subscribers.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    try {
      return await Subscriber.count()
    }
    catch (error) {
      return dashboardOperationalError(error, 'Subscriber total could not be loaded.', 'GetSubscriberCount')
    }
  },
})
