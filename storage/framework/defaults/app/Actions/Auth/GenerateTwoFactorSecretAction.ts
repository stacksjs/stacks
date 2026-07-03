import { Action } from '@stacksjs/actions'
import { generateTwoFactorSetup, stashPendingTwoFactorSecret } from '@stacksjs/auth'
import { config } from '@stacksjs/config'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'GenerateTwoFactorSecretAction',
  description: 'Generate a new TOTP secret + otpauth URI for the authenticated user to scan',
  method: 'POST',
  async handle(request: RequestInstance) {
    const user = await request.user()
    if (!user)
      return response.unauthorized('Unauthorized')

    const appName = config.app?.name || 'Stacks'
    const { secret, uri } = generateTwoFactorSetup(user.email ?? '', appName)

    // Not persisted to users.two_factor_secret until EnableTwoFactorAction
    // verifies a code produced from it — but stashed server-side now so
    // that step never has to trust a client-supplied secret. See
    // two-factor.ts's doc comment for why.
    await stashPendingTwoFactorSecret(user.id as number, secret)

    return response.json({ secret, uri })
  },
})
