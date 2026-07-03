import { Action } from '@stacksjs/actions'
import { Auth, disableTwoFactor } from '@stacksjs/auth'
import { response } from '@stacksjs/router'
import { schema } from '@stacksjs/validation'

export default new Action({
  name: 'DisableTwoFactorAction',
  description: 'Disable TOTP 2FA for the authenticated user, after re-confirming their password',
  method: 'POST',

  validations: {
    password: {
      rule: schema.string().min(1),
      message: 'Password is required to disable two-factor authentication.',
    },
  },

  async handle(request: RequestInstance) {
    const user = await request.user()
    if (!user)
      return response.unauthorized('Unauthorized')

    const password = request.get('password')

    // Disabling 2FA weakens the account — require the password again
    // rather than trusting the bearer token alone (a stolen/leaked
    // token shouldn't be enough to turn off the second factor it's
    // meant to help guard against).
    const confirmed = await Auth.validate({ email: user.email, password })
    if (!confirmed)
      return response.unauthorized('Incorrect password')

    await disableTwoFactor(user.id as number)

    return response.json({ enabled: false })
  },
})
