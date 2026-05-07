import { Action } from '@stacksjs/actions'
import { Subscriber, SubscriberEmail } from '@stacksjs/orm'
import { rateLimit } from '@stacksjs/router'
import { sendSubscriptionConfirmation } from '../Mail/SubscriptionConfirmation'

export default new Action({
  name: 'SubscriberEmailAction',
  description: 'Save emails from subscribe page and send confirmation email',
  method: 'POST',

  async handle(request: RequestInstance) {
    // Per-IP throttle. The endpoint is unauthenticated and skipCsrf'd so
    // bots will find it; without this they can flood the subscribers
    // table within minutes and burn through SES/SendGrid quota. 10/min
    // is generous for a real human filling the same form repeatedly.
    await rateLimit('email-subscribe', 10).per('minute')

    const email = request.get('email')
    const source = request.get('source') || 'homepage'

    if (!email || !email.includes('@')) {
      return { success: false, message: 'A valid email is required' }
    }

    // Check if subscriber already exists
    const existingSubscriber = await Subscriber.where('email', email).first()
    if (existingSubscriber) {
      return { success: true, message: 'Already subscribed' }
    }

    // Create subscriber record
    const subscriber = await Subscriber.create({ email, status: 'subscribed', source })

    // Log the email event
    await SubscriberEmail.create({ email, source })

    // Send subscription confirmation email asynchronously (do not block the response)
    sendSubscriptionConfirmation({
      to: email,
      subscriberUuid: subscriber.uuid,
    }).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`Failed to send confirmation email to ${email}:`, message)
    })

    return { success: true, subscriber }
  },
})
