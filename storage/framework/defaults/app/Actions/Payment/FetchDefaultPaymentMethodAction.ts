import { Action } from '@stacksjs/actions'
import { isBillable } from '@stacksjs/orm'
import { BILLING_NOT_ENABLED } from '@stacksjs/payments'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'FetchDefaultPaymentMethodAction',
  description: 'Fetch the users default payment method',
  method: 'GET',
  async handle(request: RequestInstance) {
    const user = await request.user()

    if (!user)
      return response.unauthorized('Authentication required')

    if (!isBillable(user))
      return response.error(BILLING_NOT_ENABLED, 503)

    const paymentMethod = await user.defaultPaymentMethod()

    return response.json(paymentMethod)
  },
})
