import { Action } from '@stacksjs/actions/runtime'
import { isBillable } from '@stacksjs/orm'
import { BILLING_NOT_ENABLED } from '@stacksjs/payments'
import { response } from '@stacksjs/router'
import { paymentFailure } from './payment-response'

export default new Action({
  name: 'DeleteDefaultPaymentAction',
  description: 'Delete the customers default payment method',
  method: 'POST',
  async handle(request: RequestInstance) {
    const user = await request.user()

    if (!user)
      return response.unauthorized('Authentication required')

    if (!isBillable(user))
      return response.error(BILLING_NOT_ENABLED, 503)

    // The provider's id for the method, as `paymentMethods` lists it.
    const paymentMethod = request.get('paymentMethod')
    if (typeof paymentMethod !== 'string' || !paymentMethod)
      return response.json({ message: 'A `paymentMethod` id is required.' }, 422)

    try {
      await user.removePaymentMethod(paymentMethod)
      return response.json({ ok: true })
    }
    catch (error) {
      return paymentFailure(error)
    }
  },
})
