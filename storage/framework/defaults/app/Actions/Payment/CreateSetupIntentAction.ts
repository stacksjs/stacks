import { Action } from '@stacksjs/actions'
import { isBillable } from '@stacksjs/orm'
import { BILLING_NOT_ENABLED } from '@stacksjs/payments'
import { response } from '@stacksjs/router'

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

    const setupIntent = await user.createSetupIntent({
      payment_method_types: ['card', 'link', 'us_bank_account'],
    })

    return response.json(setupIntent)
  },
})
