import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import User from '../../../storage/framework/orm/src/models/User.ts'

export default new Action({
  name: 'CreateCheckoutAction',
  description: 'Create Checkout link for stripe',
  method: 'POST',
  async handle(request: RequestInstance) {
    const user = await User.find(1)

    const checkout = await user?.checkout({'price_1QBEfsBv6MhUdo23avVV0kqx': 1})

    return checkout
  },
})
