import { Action } from '@stacksjs/actions'
import { HttpError } from '@stacksjs/error-handling'
import { isBillable } from '@stacksjs/orm'
import { BILLING_NOT_ENABLED } from '@stacksjs/payments'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'CreatePaymentIntentAction',
  description: 'Create Payment Intent for stripe',
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

    // The Product model's column is `price`; `unit_price` has never been one,
    // so that read was undefined and the intent was created for NaN. And the
    // method is `createPayment`: `user.paymentIntent()` never existed.
    const paymentIntent = await user.createPayment(Number(product.get('price')), {
      currency: 'usd',
      payment_method_types: ['card'],
    })

    return response.json(paymentIntent)
  },
})
