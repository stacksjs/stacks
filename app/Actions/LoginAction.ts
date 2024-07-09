import { Action } from '@stacksjs/actions'
import { schema } from '@stacksjs/validation'
// import { epmailSubscribeRequest } from '@stacksjs/validation'
import type { UserRequestType } from '../../storage/framework/types/requests'

export default new Action({
  name: 'LoginAction',
  description: 'Login to Dashboard',
  method: 'POST',
  async handle(request: UserRequestType) {
    const email = request.get('email')

    await request.validate({
      email: {
        validation: {
          rule: schema.string().email(),
          message: {
            email: 'Email must be a valid email address',
          },
        },
      },

      password: {
        validation: {
          rule: schema.string().minLength(6).maxLength(255),
          message: {
            minLength: 'Password must have a minimum of 6 characters',
            maxLength: 'Password must have a maximum of 255 characters',
          },
        },
      },
    })
  },
})
