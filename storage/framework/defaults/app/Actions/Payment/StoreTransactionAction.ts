import { Action } from '@stacksjs/actions'
import { isBillable } from '@stacksjs/orm'
import { BILLING_NOT_ENABLED } from '@stacksjs/payments'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'StoreTransactionAction',
  description: 'Store transactions',
  method: 'POST',
  async handle(request: RequestInstance) {
    const productId = Number(request.get('productId'))

    const user = await request.user()

    if (!user)
      return response.unauthorized('Authentication required')

    if (!isBillable(user))
      return response.error(BILLING_NOT_ENABLED, 503)

    // A transaction records a payment that already happened, so it needs the
    // Stripe id of that payment and the card brand it was made with. The call
    // used to pass neither, and threw reading `options.description`.
    const providerId = String(request.get('providerId') ?? '')
    const brand = String(request.get('brand') ?? '')

    if (!providerId || !brand)
      return response.error('A transaction needs the `providerId` of the Stripe payment and the card `brand`.', 422)

    const transaction = await user.storeTransaction(productId, {
      provider_id: providerId,
      brand,
      description: request.get('description') ? String(request.get('description')) : undefined,
    })

    return response.json(transaction)
  },
})
