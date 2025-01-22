import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'FetchUserSubscriptionsAction',
  description: 'Fetch the users subscriptions',
  method: 'GET',
  async handle(request: RequestInstance) {
    const userId = Number(request.getParam('id'))
    const user = await User.with(['subscriptions']).find(userId)

    const subscriptions = await user?.subscriptions

    return response.json(subscriptions)
  },
})
