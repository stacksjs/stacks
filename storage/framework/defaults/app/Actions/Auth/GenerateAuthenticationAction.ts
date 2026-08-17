import type { PublicKeyCredentialRequestOptionsJSON } from '@stacksjs/auth'
import { Action } from '@stacksjs/actions'
import {
  generateAuthenticationOptions,
  getUserPasskeys,
  passkeyDescriptors,
  storeWebAuthnChallenge,
} from '@stacksjs/auth'
import { config } from '@stacksjs/config'
import { User } from '@stacksjs/orm'

export default new Action({
  name: 'PasskeyAuthenticationAction',
  description: 'Generate Passkey Authentication Options',
  method: 'POST',
  async handle(request: RequestInstance) {
    const email = request.get('email')

    if (!email) {
      return Response.json({ error: 'Email is required' }, { status: 422 })
    }

    const user = await User.where('email', email).first()

    if (!user) {
      return Response.json({ error: 'User not found' }, { status: 404 })
    }

    const userPasskeys = await getUserPasskeys(user.id as number)

    // Use configured app URL for rpID instead of hardcoded localhost
    const appUrl = config.app?.url || 'localhost'
    const rpID = new URL(appUrl.startsWith('http') ? appUrl : `https://${appUrl}`).hostname

    const options = await generateAuthenticationOptions({
      rpID,
      // `passkeyDescriptors` explains the JSON-vs-ArrayBuffer boundary; since
      // ts-auth 0.4.4 the descriptor type accepts the base64url id directly.
      allowCredentials: passkeyDescriptors(userPasskeys),
    }) as unknown as PublicKeyCredentialRequestOptionsJSON

    // Persist the challenge server-side so `VerifyAuthenticationAction`
    // can consume it from the DB instead of trusting `body.challenge`.
    // The previous round-trip-through-the-client pattern let an
    // attacker who captured an assertion replay it as long as they
    // also captured the challenge. See stacksjs/stacks#1866.
    await storeWebAuthnChallenge(user.id as number, options.challenge, 'authentication')

    return options
  },
})
