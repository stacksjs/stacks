import type { AuthenticationResponseJSON } from '@stacksjs/auth'
import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { getUserPasskey, verifyAuthenticationResponse } from '@stacksjs/auth'
import { User } from '@stacksjs/orm'

export default new Action({
  name: 'VerifyAuthenticationAction',
  description: 'Verify authentication from passkey',
  method: 'POST',
  async handle(request: RequestInstance) {
    const body = request.all()

    const passkeyRes: AuthenticationResponseJSON = body.res

    const email = request.get('email') ?? ''

    const user = await User.where('email', email).first()

    const userPasskey = await getUserPasskey(user?.id as number, body.res.id as string)

    if (!user || !userPasskey)
      return

    const pubkeyString = userPasskey.cred_public_key

    const jsonParse = JSON.parse(pubkeyString) as JSON

    const uint8Array = new Uint8Array(Object.values(jsonParse))

    try {
      const verification = await verifyAuthenticationResponse({
        response: passkeyRes,
        expectedChallenge: body.challenge,
        expectedOrigin: 'http://localhost:3333',
        expectedRPID: 'localhost',
        credential: {
          id: userPasskey?.id,
          publicKey: uint8Array,
          counter: userPasskey.counter,
          transports: ['internal'],
        },
      })

      return verification
    }
    catch (error) {
      console.error(error)
    }
  },
})
