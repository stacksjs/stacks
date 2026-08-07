import { Action } from '@stacksjs/actions'
import { Auth, register } from '@stacksjs/auth'
import { dispatch } from '@stacksjs/events'
import { response } from '@stacksjs/router'
import { schema } from '@stacksjs/validation'
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, PASSWORD_POLICY_MESSAGE } from '../../password-policy'

export default new Action({
  name: 'RegisterAction',
  description: 'Register a new user',
  method: 'POST',

  validations: {
    email: {
      rule: schema.string().email(),
      message: 'Email must be a valid email address.',
    },
    password: {
      rule: schema.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH),
      message: PASSWORD_POLICY_MESSAGE,
    },
    name: {
      rule: schema.string().min(2).max(255),
      message: 'Name must be between 2 and 255 characters.',
    },
  },

  async handle(request: RequestInstance) {
    const email = request.get('email')
    const password = request.get('password')
    const name = request.get('name')

    const result = await register({ email, password, name })

    if (result) {
      const user = await Auth.getUserFromToken(result.token)

      // Fire `user:registered` so app/Events.ts listeners (welcome email,
      // CRM sync, internal slack ping, etc.) actually run. Fire-and-forget
      // — listener errors are caught by the wildcard handler so a flaky
      // welcome email doesn't fail registration. The `to` alias matches
      // the contract SendWelcomeEmail expects.
      dispatch('user:registered', {
        id: user?.id,
        email: user?.email,
        name: user?.name,
        to: user?.email,
      })

      // Same OAuth2-compatible payload LoginAction returns, so a client can
      // code against one shape. Registering used to hand back only `token`,
      // which left brand-new accounts with no refresh token to exchange — they
      // were signed out an hour into their first session while every other
      // user refreshed normally (stacksjs/stacks#2212). The legacy `token`
      // alias stays for backward compatibility.
      return response.json({
        access_token: result.token,
        refresh_token: result.refreshToken,
        token_type: 'Bearer',
        expires_in: result.expiresIn,
        token: result.token,
        user: {
          id: user?.id,
          email: user?.email,
          name: user?.name,
        },
      })
    }

    return response.error('Registration failed')
  },
})
