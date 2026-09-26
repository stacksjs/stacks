import { Action } from '@stacksjs/actions'
import { isBillable } from '@stacksjs/orm'
import { BILLING_NOT_ENABLED } from '@stacksjs/payments'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'SetUserDefaultPaymentAction',
  description: 'Set the customers default payment method from provider callback',
  method: 'POST',
  async handle(request: RequestInstance) {
    const user = await request.user()

    if (!user)
      return response.unauthorized('Authentication required')

    if (!isBillable(user))
      return response.error(BILLING_NOT_ENABLED, 503)

    const paymentId = String(request.get('setupIntent'))

    // A string id is Stripe's own `pm_...`, which `setDefaultPaymentMethod`
    // resolves on Stripe's side. `setUserDefaultPaymentMethod()` never existed.
    const paymentMethod = await user.setDefaultPaymentMethod(paymentId)

    return response.json(paymentMethod)
  },
})
