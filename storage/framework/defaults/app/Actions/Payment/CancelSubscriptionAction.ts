import { Action } from '@stacksjs/actions/runtime'
import { isBillable, SubscriptionNotOwnedError } from '@stacksjs/orm'
import { BILLING_NOT_ENABLED } from '@stacksjs/payments'
import { response } from '@stacksjs/router'
import { forBrowser, paymentFailure } from './payment-response'

export default new Action({
  name: 'CancelSubscriptionAction',
  description: 'Cancel the caller\'s subscription, now or at the end of its period',
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
      const subscription = await user.cancelSubscription(providerId, { atPeriodEnd: request.get('atPeriodEnd') === true })
      return response.json(forBrowser(subscription))
    }
    catch (error) {
      if (error instanceof SubscriptionNotOwnedError)
        return response.json({ error: 'Subscription not found' }, 404)
      return paymentFailure(error)
    }
  },
})
