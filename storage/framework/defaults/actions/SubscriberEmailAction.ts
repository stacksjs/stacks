import { Action } from '@stacksjs/actions'
import { Subscriber, SubscriberEmail } from '@stacksjs/orm'

export default new Action({
  name: 'SubscriberEmailAction',
  description: 'Save emails from subscribe page',
  method: 'POST',

  async handle(request: RequestInstance) {
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

    return { success: true, subscriber }
  },
})
