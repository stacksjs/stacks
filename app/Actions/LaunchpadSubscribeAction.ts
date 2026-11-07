import { rateLimit } from '@stacksjs/router'
import { sendSubscriptionConfirmation } from '@stacksjs/defaults/app/Mail/SubscriptionConfirmation.ts'
import { subscribeToLaunchpad } from '../Services/launchpad-subscriptions'

export default new Action({
  name: 'Subscribe to Launchpad updates',
  description: 'Join the native Launchpad subscriber list without altering other subscriptions.',
  method: 'POST',
  validations: { email: { rule: schema.string().email().max(255) } },
  async handle(request) {
    await rateLimit('launchpad-subscribe', 10).per('minute')
    const email = request.get('email')
    if (typeof email !== 'string') return Response.json({ success: false, message: 'A valid email is required' }, { status: 422 })
    const subscription = await subscribeToLaunchpad(email)
    if (subscription.created) {
      // This token belongs to the Launchpad membership. The native unsubscribe
      // route leaves every other list and transactional delivery alone.
      sendSubscriptionConfirmation({ to: subscription.email, subscriberUuid: subscription.token }).catch((error: unknown) => {
        console.error('Launchpad subscription confirmation could not be sent:', error instanceof Error ? error.message : 'delivery failed')
      })
    }
    // Neither subscriber identity nor unsubscribe tokens belong in the public response.
    return { success: true, message: 'You’re subscribed to Launchpad updates.' }
  },
})
