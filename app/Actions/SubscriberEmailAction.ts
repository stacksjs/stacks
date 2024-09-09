import { Action } from '@stacksjs/actions'
// import { schema } from '@stacksjs/validation'
// import { epmailSubscribeRequest } from '@stacksjs/validation'
import SubscriberEmail from '../../storage/framework/orm/src/models/SubscriberEmail'
import type { SubscriberEmailRequestType } from '../../storage/framework/types/requests'

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
