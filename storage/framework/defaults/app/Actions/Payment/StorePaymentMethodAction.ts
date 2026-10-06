import { Action } from '@stacksjs/actions/runtime'
import { isBillable } from '@stacksjs/orm'
import { BILLING_NOT_ENABLED } from '@stacksjs/payments'
import { response } from '@stacksjs/router'
import { forBrowser, paymentFailure } from './payment-response'

export default new Action({
  name: 'StorePaymentMethodAction',
  description: 'Store the customers payment methods',
  method: 'POST',
  async handle(request: RequestInstance) {
    const user = await request.user()

    if (!user)
      return response.unauthorized('Authentication required')

    if (!isBillable(user))
      return response.error(BILLING_NOT_ENABLED, 503)

    const paymentIntent = request.get('setupIntent') as string

    try {
      return response.json(forBrowser(await user.addPaymentMethod(paymentIntent)))
    }
    catch (error) {
      return paymentFailure(error)
    }
  },
})
