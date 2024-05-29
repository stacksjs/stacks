import { Action } from '@stacksjs/actions'
// import { request } from '@stacksjs/router'
// import { epmailSubscribeRequest } from '@stacksjs/validation'
import { validateField } from '@stacksjs/validation'
import SubscriberEmail from '../../storage/framework/orm/src/models/SubscriberEmail'

export interface EmailSubscribeRequest extends Request {
  email: string
}

export default new Action({
  name: 'EmailSubscribeAction',
  description: 'Save emails from subscribe page',
  method: 'POST',
  // validations: {
  //   email: {
  //     rule: schema.string().email(),
  //     message: {
  //       email: 'Email must be valid',
  //       required: 'Email is required',
  //     }
  //   },
  // },
  // async handle(request) {
  async handle(request: EmailSubscribeRequest) {
    // We pass the model name cause how else do we know which fields to validate
    request.validate({
      email: {
        rule: schema.string().email(),
        message: {
          email: 'Email must be valid',
          required: 'Email is required',
        },
      },
    })
    await validateField('SubscriberEmail', request.all())
    // we know the request is validated

    const email = request.get('email')

    const model = await SubscriberEmail.create({ email })

    return model
  },
})
