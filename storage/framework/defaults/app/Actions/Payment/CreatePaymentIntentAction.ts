import { Action } from '@stacksjs/actions'
import { HttpError } from '@stacksjs/error-handling'
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

    if (!product) {
      throw new HttpError(422, 'Product not found!')
    }

    const paymentIntent = await user?.paymentIntent({
      // The Product model's column is `price`; `unit_price` has never been
      // one, so this read was undefined and the intent was created for NaN.
      amount: Number(product.get('price')),
      currency: 'usd',
      payment_method_types: ['card'],
    })

    return response.json(paymentIntent)
  },
})
