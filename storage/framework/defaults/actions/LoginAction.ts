// import { epmailSubscribeRequest } from '@stacksjs/validation'
import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { attempt, authToken, team } from '@stacksjs/auth'
import { schema } from '@stacksjs/validation'

export default new Action({
  name: 'LoginAction',
  description: 'Login to Dashboard',
  method: 'POST',
  async handle(request: RequestInstance) {
    const email = request.get('email')
    const password = request.get('password')

    await request.validate({
      email: {
        rule: schema.string().email(),
        message: {
          email: 'Email must be a valid email address',
        },
      },

      password: {
        rule: schema.string().min(6).max(255),
        message: {
          min(: 'Password must have a minimum of 6 characters',
          maxLength: 'Password must have a maximum of 255 characters',
        },
      },
    })

    if (await attempt({ email, password })) {
      const token = await authToken()

      const teamValue = await team()

      return { token, team: teamValue }
    }

    return { message: 'Incorrect email or password', status: 401 }
  },
})
