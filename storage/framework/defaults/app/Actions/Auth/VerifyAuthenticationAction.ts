import type { AuthenticationCredential } from '@stacksjs/auth'
import { Action } from '@stacksjs/actions'
import {
  consumeWebAuthnChallenge,
  getUserPasskey,
  updatePasskeyCounter,
  verifyAuthenticationResponse,
} from '@stacksjs/auth'
import { config } from '@stacksjs/config'
import { response } from '@stacksjs/router'
import { User } from '@stacksjs/orm'

export default new Action({
  name: 'VerifyAuthenticationAction',
  description: 'Verify authentication from passkey',
  method: 'POST',
  async handle(request: RequestInstance) {
    const body = request.all()
    const credential = body.res as AuthenticationCredential

    const email = request.get('email') ?? ''

    const user = await User.where('email', email).first()

    if (!user)
      return response.notFound('User not found')

    const userPasskey = await getUserPasskey(user.id as number, credential.id)

    if (!userPasskey)
      return response.notFound('Passkey not found')

    // Read + delete the server-stored challenge for this user. The
    // previous flow trusted `body.challenge` from the client, which
    // let an attacker replay a captured assertion as long as they
    // had the original challenge. Closing this gap was stacksjs/stacks#1866.
    const expectedChallenge = await consumeWebAuthnChallenge(user.id as number, 'authentication')
    if (!expectedChallenge)
      return response.unauthorized('Authentication challenge missing or expired — please retry from the start.')

    const pubkeyString = userPasskey.cred_public_key
    let jsonParse: Record<string, number>
    try {
      jsonParse = JSON.parse(pubkeyString) as Record<string, number>
    }
    catch {
      return response.serverError('Invalid public key format')
    }
    const publicKey = new Uint8Array(Object.values(jsonParse)).buffer

    // Convert challenge string to Uint8Array. The challenge is stored
    // as base64url (the same form generateAuthenticationOptions emits).
    const challengeBytes = Uint8Array.from(atob(expectedChallenge), c => c.charCodeAt(0))

    // Derive origin and rpID from app config instead of hardcoding localhost
    const appUrl = config.app?.url || 'http://localhost:3333'
    const expectedOrigin = appUrl.startsWith('http') ? appUrl : `https://${appUrl}`
    const expectedRPID = new URL(expectedOrigin).hostname

    try {
      const verification = await verifyAuthenticationResponse(
        credential,
        challengeBytes,
        expectedOrigin,
        expectedRPID,
        publicKey,
        userPasskey.counter,
      )

      if (!verification.verified)
        return response.unauthorized('Authentication failed')

      // Anti-cloning: persist the new counter and reject if it didn't
      // advance. WebAuthn authenticators monotonically increment on
      // every use; a counter that's not strictly greater than the
      // stored value indicates a cloned/replayed credential. See
      // updatePasskeyCounter() and stacksjs/stacks#1861 A-4.
      const newCounter = verification.authenticationInfo?.newCounter
      if (typeof newCounter === 'number') {
        const advanced = await updatePasskeyCounter(user.id as number, credential.id, newCounter)
        if (!advanced) {
          console.warn(`[VerifyAuthenticationAction] Refusing passkey login for user ${user.id} (${credential.id}): counter did not advance (stored=${userPasskey.counter}, received=${newCounter}) — possible cloned authenticator`)
          return response.unauthorized('Authentication failed')
        }
      }

      return response.json(verification)
    }
    catch (error) {
      console.error('Authentication verification failed:', error)
      return response.serverError('Authentication verification failed')
    }
  },
})
