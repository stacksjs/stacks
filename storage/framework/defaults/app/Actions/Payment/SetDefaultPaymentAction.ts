import { Action } from '@stacksjs/actions'
import { isBillable } from '@stacksjs/orm'
import { BILLING_NOT_ENABLED } from '@stacksjs/payments'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'SetDefaultPaymentAction',
  description: 'Set the customers default payment method',
  method: 'POST',
  async handle(request: RequestInstance) {
    const user = await request.user()

    if (!user)
      return response.unauthorized('Authentication required')

    if (!isBillable(user))
      return response.error(BILLING_NOT_ENABLED, 503)

    // The payment store posts `{ paymentId }`; this read only `setupIntent`, so
    // it saw undefined and asked for payment method NaN. `setupIntent` is still
    // read for any client written against the old name.
    const paymentId = Number(request.get('paymentId') ?? request.get('setupIntent'))

    const paymentMethod = await user.setDefaultPaymentMethod(paymentId)

    return response.json(paymentMethod)
  },
})
