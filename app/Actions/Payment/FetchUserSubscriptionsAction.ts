import { Action } from '@stacksjs/actions'
import User from '../../../storage/framework/orm/src/models/User.ts'

export default new Action({
  name: 'FetchUserSubscriptionsAction',
  description: 'Fetch the users subscriptions',
  method: 'GET',
  async handle() {
    const user = await User.find(1)

    const subscriptions = await user?.subscriptions()

    return subscriptions
  },
})
