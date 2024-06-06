import { Action } from '@stacksjs/actions'
// import { epmailSubscribeRequest } from '@stacksjs/validation'
import SubscriberEmail from '../../storage/framework/orm/src/models/SubscriberEmail'
import { SubscriberEmailRequestType } from '../../storage/framework/requests/SubscriberEmailRequest'

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