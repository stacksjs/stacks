import { Action } from '@stacksjs/actions/runtime'
import { config } from '@stacksjs/config'
import { HttpError } from '@stacksjs/error-handling'
import { isBillable } from '@stacksjs/orm'
import { BILLING_NOT_ENABLED } from '@stacksjs/payments'
import { response } from '@stacksjs/router'
import { forBrowser, paymentFailure } from './payment-response'

/**
 * Start a payment for a product, completed in the browser on the provider's
 * SDK. Answers the payment with its `clientConfirmation`: a Stripe client
 * secret, or an Adyen session (which also needs `returnUrl`).
 */
export default new Action({
  name: 'CreatePaymentIntentAction',
  description: 'Start a payment for a product, completed in the browser',
  method: 'POST',
  async handle(request: RequestInstance) {
    const productId = Number(request.get('productId'))

    const product = await Product.find(productId)

    const user = await request.user()

    if (!user)
      return response.unauthorized('Authentication required')

    if (!isBillable(user))
      return response.error(BILLING_NOT_ENABLED, 503)

    if (!product) {
      throw new HttpError(422, 'Product not found!')
    }

    // The currency the app configures, not a hard-coded USD; the product's
    // price is already in minor units.
    const currency = String((config as { payment?: { currency?: string } }).payment?.currency || 'usd')
    const returnUrl = request.get('returnUrl')

    try {
      const payment = await user.createPayment(
        { amount: Number(product.get('price')), currency },
        { reference: `product-${productId}`, ...(typeof returnUrl === 'string' && returnUrl ? { returnUrl } : {}) },
      )
      return response.json(forBrowser(payment))
    }
    catch (error) {
      return paymentFailure(error)
    }
  },
})
