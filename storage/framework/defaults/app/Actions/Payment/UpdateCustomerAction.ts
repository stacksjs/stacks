import { Action } from '@stacksjs/actions'
import { isBillable } from '@stacksjs/orm'
import { BILLING_NOT_ENABLED } from '@stacksjs/payments'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'UpdateCustomerAction',
  description: 'Update customer detauls',
  method: 'POST',
  async handle(request: RequestInstance) {
    const user = await request.user()

    if (!user)
      return response.unauthorized('Authentication required')

    if (!isBillable(user))
      return response.error(BILLING_NOT_ENABLED, 503)

    // The address comes from the request. It was a hard-coded placeholder, so
    // every customer synced through here was moved to the same street in
    // Austin.
    const field = (key: string): string | undefined => {
      const value = request.get(key)
      return typeof value === 'string' && value !== '' ? value : undefined
    }

    const customer = await user.syncStripeCustomerDetails({
      address: {
        line1: field('line1'),
        line2: field('line2'),
        city: field('city'),
        state: field('state'),
        postal_code: field('postal_code'),
        country: field('country'),
      },
    })

    return response.json(customer)
  },
})
