import { Action } from '@stacksjs/actions'
import { isBillable, SubscriptionNotOwnedError } from '@stacksjs/orm'
import { BILLING_NOT_ENABLED } from '@stacksjs/payments'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'CancelSubscriptionAction',
  description: 'Cancel Subscription for stripe',
  method: 'POST',
  async handle(request: RequestInstance) {
    const providerId = request.get<unknown>('providerId')

    const user = await request.user()

    if (!user)
      return response.unauthorized('Authentication required')

    if (!isBillable(user))
      return response.error(BILLING_NOT_ENABLED, 503)

    if (typeof providerId !== 'string' || !providerId)
      return response.json({ error: 'providerId is required' }, 422)

    // Only the caller's own subscription: the trait checks ownership, and one
    // 404 covers both "no such subscription" and "someone else's".
    try {
      // `cancelSubscription` answers `{ subscription }` and nothing else. This
      // returned `.paymentIntent` off it, which is always undefined.
      const { subscription } = await user.cancelSubscription(providerId)
      return response.json(subscription)
    }
    catch (error) {
      if (error instanceof SubscriptionNotOwnedError)
        return response.json({ error: 'Subscription not found' }, 404)
      throw error
    }
  },
})
