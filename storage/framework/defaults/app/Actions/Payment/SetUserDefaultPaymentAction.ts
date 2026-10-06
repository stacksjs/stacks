import { Action } from '@stacksjs/actions/runtime'
import { isBillable } from '@stacksjs/orm'
import { BILLING_NOT_ENABLED } from '@stacksjs/payments'
import { response } from '@stacksjs/router'
import { paymentFailure, paymentMethodReference } from './payment-response'

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

    // The payment store posts `{ paymentId }`; `setupIntent` is still read for
    // a client written against the old name. Either a local row id or the
    // provider's own `pm_...` id.
    const paymentMethod = paymentMethodReference(request.get('setupIntent') ?? request.get('paymentId'))
    if (paymentMethod === null)
      return response.json({ message: 'A `paymentId` is required.' }, 422)

    try {
      await user.setDefaultPaymentMethod(paymentMethod)
      return response.json({ ok: true })
    }
    catch (error) {
      return paymentFailure(error)
    }
  },
})
