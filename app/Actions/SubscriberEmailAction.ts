import { Action } from '@stacksjs/actions'
import { schema } from '@stacksjs/validation'
// import { epmailSubscribeRequest } from '@stacksjs/validation'
import SubscriberEmail from '../../storage/framework/orm/src/models/SubscriberEmail'
import type { SubscriberEmailRequestType } from '../../storage/framework/types/requests'

export default new Action({
  name: 'SubscriberEmailAction',
  description: 'Save emails from subscribe page',
  method: 'POST',
  validations: {
    status: {
      rule: schema.string().minLength(5).maxLength(255),
      message: {
        minLength: 'Name must have a minimum of 3 characters',
        maxLength: 'Name must have a maximum of 255 characters',
      },
    },
  },
  async handle(request: SubscriberEmailRequestType) {
    const email = request.get('email')

    const model = await SubscriberEmail.create({ email })

    return model
  },
})
