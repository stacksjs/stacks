import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'FetchUserSubscriptionsAction',
  description: 'Fetch the users subscriptions',
  method: 'GET',
  async handle(request: RequestInstance) {
    const user = await request.user()

    if (!user)
      return response.unauthorized('Authentication required')

    const subscriptions = await user?.subscriptions

    return response.json(subscriptions)
  },
})
