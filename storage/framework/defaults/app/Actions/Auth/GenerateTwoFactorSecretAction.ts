import { Action } from '@stacksjs/actions'
import { generateTwoFactorSetup, stashPendingTwoFactorSecret } from '@stacksjs/auth'
import { config } from '@stacksjs/config'
import { response } from '@stacksjs/router'
import { toSvg } from 'ts-qr-codes'

export default new Action({
  name: 'GenerateTwoFactorSecretAction',
  description: 'Generate a new TOTP secret, otpauth URI and scannable QR code for the authenticated user',
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

    // Rendered here rather than left to the client. Every authenticator flow
    // needs the URI as a QR code, and a caller that has to find its own
    // encoder either ships one to the browser or, more often, falls back to
    // asking the user to type a 32-character secret by hand.
    //
    // SVG so it stays sharp at any size and can be inlined into a page or an
    // email; the URI is still returned for clients that render their own.
    const qr = toSvg(uri, { size: 240, title: 'Two-factor authentication setup' })

    return response.json({ secret, uri, qr })
  },
})
