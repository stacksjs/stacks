import type { SubscriberEmailRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'
import { SubscriberEmail } from '@stacksjs/orm'

export default new Action({
  name: 'SubscriberEmailAction',
  description: 'Save emails from subscribe page',
  method: 'POST',

  async handle(request: SubscriberEmailRequestType) {
    const email = request.get('email')

    // Check if email already exists
    const existing = await SubscriberEmail.where('email', email).first()
    if (existing) {
      return { success: true, message: 'Already subscribed' }
    }

    const model = await SubscriberEmail.create({ email })

    return { success: true, subscriber: model }
  },
})
