import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'CreateCheckoutAction',
  description: 'Create Checkout link for stripe',
  method: 'POST',
  async handle(request: RequestInstance) {
    const userId = Number(request.getParam('id'))

    const user = await User.find(userId)

    const checkout = await user?.checkout([
      {
        priceId: 'price_1QBEfsBv6MhUdo23avVV0kqx',
        quantity: 1,
      },
    ], {
      enableTax: true,
      allowPromotions: true,
      cancel_url: 'https://google.com',
      success_url: 'https://google.com',
    })

    return response.json(checkout)
  },
})
