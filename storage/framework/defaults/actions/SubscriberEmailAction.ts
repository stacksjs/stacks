import type { SubscriberEmailRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'
import { SubscriberEmail } from '@stacksjs/orm'

export default new Action({
  name: 'SubscriberEmailAction',
  description: 'Save emails from subscribe page',
  method: 'POST',

  async handle(request: SubscriberEmailRequestType) {
    const email = request.get('email')

    const model = await SubscriberEmail.create({ email })

    return model
  },
})
