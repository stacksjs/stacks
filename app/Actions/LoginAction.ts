import { Action } from '@stacksjs/actions'
// import { epmailSubscribeRequest } from '@stacksjs/validation'
import type { RequestInstance } from '@stacksjs/types'
import { schema } from '@stacksjs/validation'

export default new Action({
  name: 'LoginAction',
  description: 'Login to Dashboard',
  method: 'POST',
  async handle(request: RequestInstance) {
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
    })
  },
})
