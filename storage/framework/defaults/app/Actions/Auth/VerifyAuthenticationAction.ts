import type { AuthenticationCredential } from '@stacksjs/auth'
import { Action } from '@stacksjs/actions'
import { getUserPasskey, verifyAuthenticationResponse } from '@stacksjs/auth'
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
    const challenge = body.challenge as string

    const email = request.get('email') ?? ''

    const user = await User.where('email', email).first()

    if (!user)
      return response.notFound('User not found')

    const userPasskey = await getUserPasskey(user.id as number, credential.id)

    if (!userPasskey)
      return response.notFound('Passkey not found')

    const pubkeyString = userPasskey.cred_public_key
    let jsonParse: Record<string, number>
    try {
      jsonParse = JSON.parse(pubkeyString) as Record<string, number>
    }
    catch {
      return response.serverError('Invalid public key format')
    }
    const publicKey = new Uint8Array(Object.values(jsonParse)).buffer

    // Convert challenge string to Uint8Array
    const challengeBytes = Uint8Array.from(atob(challenge), c => c.charCodeAt(0))

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

      return response.json(verification)
    }
    catch (error) {
      console.error('Authentication verification failed:', error)
      return response.serverError('Authentication verification failed')
    }
  },
})
