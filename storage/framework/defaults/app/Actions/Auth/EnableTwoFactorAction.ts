import { Action } from '@stacksjs/actions'
import { consumePendingTwoFactorSecret, enableTwoFactor } from '@stacksjs/auth'
import { response } from '@stacksjs/router'
import { schema } from '@stacksjs/validation'

export default new Action({
  name: 'EnableTwoFactorAction',
  description: 'Verify a TOTP setup code against the server-stashed pending secret and, if valid, enable 2FA',
  method: 'POST',

  validations: {
    code: {
      rule: schema.string().min(6).max(6),
      message: 'Code must be a 6-digit TOTP code.',
    },
  },

  async handle(request: RequestInstance) {
    const user = await request.user()
    if (!user)
      return response.unauthorized('Unauthorized')

    const code = request.get('code')

    // The secret is never taken from the client — see
    // GenerateTwoFactorSecretAction / two-factor.ts's doc comment.
    const pendingSecret = await consumePendingTwoFactorSecret(user.id as number)
    if (!pendingSecret)
      return response.unauthorized('No pending setup found — please generate a new QR code and try again.')

    const enabled = await enableTwoFactor(user.id as number, pendingSecret, code)
    if (!enabled)
      return response.unauthorized('Invalid code — please check your authenticator app and try again.')

    return response.json({ enabled: true })
  },
})
