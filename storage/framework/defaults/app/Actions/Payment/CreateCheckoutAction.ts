import { Action } from '@stacksjs/actions'
import { isBillable } from '@stacksjs/orm'
import { BILLING_NOT_ENABLED } from '@stacksjs/payments'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'CreateCheckoutAction',
  description: 'Create Checkout link for stripe',
  method: 'POST',
  async handle(request: RequestInstance) {
    const user = await request.user()

    if (!user)
      return response.unauthorized('Authentication required')

    if (!isBillable(user))
      return response.error(BILLING_NOT_ENABLED, 503)

    const checkout = await user.checkout([
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
