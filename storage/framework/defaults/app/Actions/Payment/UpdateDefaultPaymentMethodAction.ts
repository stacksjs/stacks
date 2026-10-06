import { Action } from '@stacksjs/actions/runtime'
import { isBillable } from '@stacksjs/orm'
import { BILLING_NOT_ENABLED } from '@stacksjs/payments'
import { response } from '@stacksjs/router'
import { paymentFailure, paymentMethodReference } from './payment-response'

export default new Action({
  name: 'UpdateDefaultPaymentMethodAction',
  description: 'Update the customers default payment method',
  method: 'POST',
  async handle(request: RequestInstance) {
    const user = await request.user()

    if (!user)
      return response.unauthorized('Authentication required')

    if (!isBillable(user))
      return response.error(BILLING_NOT_ENABLED, 503)

    // A local row id or the provider's own id. This answered nothing at all,
    // so the client waited on an empty response.
    const paymentMethod = paymentMethodReference(request.get('paymentMethod'))
    if (paymentMethod === null)
      return response.json({ message: 'A `paymentMethod` is required.' }, 422)

    try {
      await user.setDefaultPaymentMethod(paymentMethod)
      return response.json({ ok: true })
    }
    catch (error) {
      return paymentFailure(error)
    }
  },
})
