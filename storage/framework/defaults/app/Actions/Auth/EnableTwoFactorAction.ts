import { Action } from '@stacksjs/actions/runtime'
import { confirmTwoFactorSetup } from '@stacksjs/auth'
import { response } from '@stacksjs/router'
import { schema } from '@stacksjs/validation/runtime'

export default new Action({
  name: 'EnableTwoFactorAction',
  description: 'Verify a TOTP setup code against the server-stashed pending secret and, if valid, enable 2FA',
  method: 'POST',

  validations: {
    code: {
      rule: schema.string().min(6).max(6).required(),
      message: 'Code must be a 6-digit TOTP code.',
    },
  },

  async handle(request: RequestInstance) {
    const user = await request.user()
    if (!user)
      return response.unauthorized('Unauthorized')

    const code = request.get('code')

    // Confirm the server-owned setup atomically. A mistyped code keeps the QR
    // usable, and recovery codes are returned once after the factor is saved.
    const result = await confirmTwoFactorSetup(user.id as number, code)
    if (!result.enabled)
      return response.json({ error: result.reason === 'missing' ? 'Setup expired. Start setup again.' : result.reason === 'already_enabled' ? 'Two-factor authentication is already enabled.' : 'Invalid code. Check your authenticator app and try again.' }, { status: 422, headers: { 'Cache-Control': 'private, no-store' } })

    return response.json(result, { headers: { 'Cache-Control': 'private, no-store' } })
  },
})
