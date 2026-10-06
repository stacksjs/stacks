import { Action } from '@stacksjs/actions/runtime'
import { isBillable } from '@stacksjs/orm'
import { BILLING_NOT_ENABLED } from '@stacksjs/payments'
import { response } from '@stacksjs/router'
import { paymentFailure } from './payment-response'

export default new Action({
  name: 'CreateSetupIntentAction',
  description: 'Create Setup Intent for stripe',
  method: 'POST',
  async handle(request: RequestInstance) {
    const user = await request.user()

    if (!user)
      return response.unauthorized('Authentication required')

    if (!isBillable(user))
      return response.error(BILLING_NOT_ENABLED, 503)

    // `allowed_payment_method_types` was passed here, which is not a Stripe
    // parameter; Stripe chooses the methods from the dashboard settings.
    try {
      return response.json(await user.createSetupIntent())
    }
    catch (error) {
      return paymentFailure(error)
    }
  },
})
