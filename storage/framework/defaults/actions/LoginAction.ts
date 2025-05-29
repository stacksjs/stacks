import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { Auth } from '@stacksjs/auth'
import { schema } from '@stacksjs/validation'

export default new Action({
  name: 'LoginAction',
  description: 'Login to the application',
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
          min: 'Password must have a minimum of 6 characters',
          max: 'Password must have a maximum of 255 characters',
        },
      },
    })

    const result = await Auth.login({ email, password })

    if (result) {
      const user = await Auth.getUserFromToken(result.token)
      return {
        token: result.token,
        user: {
          id: user?.id,
          email: user?.email,
          name: user?.name,
        },
      }
    }

    return { message: 'Incorrect email or password', status: 401 }
  },
})
