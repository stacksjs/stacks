import { Action } from '@stacksjs/actions/runtime'
import { isBillable } from '@stacksjs/orm'
import { BILLING_NOT_ENABLED } from '@stacksjs/payments'
import { response } from '@stacksjs/router'
import { forBrowser, paymentFailure } from './payment-response'

/**
 * A hosted checkout for a price, answered with the page to send the payer to.
 *
 * It used to check out a hard-coded Stripe price id from someone's account
 * and return the payer to https://google.com, which the same-origin check on
 * checkout redirects refused anyway. The price and the return pages come from
 * the request now, and the return pages must be on this app's origin.
 */
export default new Action({
  name: 'CreateCheckoutAction',
  description: 'Create a hosted checkout page for a price',
  method: 'POST',
  async handle(request: RequestInstance) {
    const user = await request.user()

    if (!user)
      return response.unauthorized('Authentication required')

    if (!isBillable(user))
      return response.error(BILLING_NOT_ENABLED, 503)

    const price = request.get('price')
    const successUrl = request.get('successUrl')
    const cancelUrl = request.get('cancelUrl')
    const mode = request.get('mode') === 'subscription' ? 'subscription' : 'payment'
    const quantity = Number(request.get('quantity') ?? 1)

    if (typeof price !== 'string' || !price)
      return response.json({ message: 'A `price` is required.' }, 422)
    if (typeof successUrl !== 'string' || !successUrl)
      return response.json({ message: 'A `successUrl` is required.' }, 422)
    if (!Number.isInteger(quantity) || quantity < 1)
      return response.json({ message: '`quantity` is a whole number of at least 1.' }, 422)

    try {
      const session = await user.checkout({
        mode,
        lines: [{ price, quantity }],
        successUrl,
        ...(typeof cancelUrl === 'string' && cancelUrl ? { cancelUrl } : {}),
      })
      return response.json(forBrowser(session))
    }
    catch (error) {
      return paymentFailure(error)
    }
  },
})
