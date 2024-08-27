import { Action } from '@stacksjs/actions'
// import { epmailSubscribeRequest } from '@stacksjs/validation'
import SubscriberEmail from '../../storage/framework/orm/src/models/SubscriberEmail'
import type { SubscriberEmailRequestType } from '../../storage/framework/types/requests'

export default new Action({
  name: 'SubscriberEmailAction',
  description: 'Save emails from subscribe page',
  method: 'POST',
  validations: {
    status: {
      rule: schema.string().minLength(3).maxLength(88),
      message: {
        minLength: 'Name must have a minimum of 3 characters',
        maxLength: 'Name must have a maximum of 255 characters',
      },
    },
  },
  async handle(request: SubscriberEmailRequestType) {
    const email = request.get('email') as string

    await request.validate()

    const model = await SubscriberEmail.create({ email })

    return model
  },
})
