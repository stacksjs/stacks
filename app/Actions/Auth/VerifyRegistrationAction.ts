import { Action } from '@stacksjs/actions'
import {
  type VerifiedRegistrationResponse,
  getUserPasskeys,
  setCurrentRegistrationOptions,
  verifyRegistrationResponse,
} from '@stacksjs/auth'
import type { RequestInstance } from '@stacksjs/types'

export default new Action({
  name: 'PasskeyRegistrationAction',
  description: 'Register a Passkey',
  method: 'POST',
  async handle(request: RequestInstance) {
    const body = request.all()

    const email = request.get('email') ?? ''

    const user = await User.where('email', email).first()

    if (!user) return

    const userPasskeys = await getUserPasskeys(user?.id as number)

    const userEmail = user?.email ?? ''

    try {
      const verification = await verifyRegistrationResponse({
        response: body.attResp,
        expectedChallenge: body.challenge,
        expectedOrigin: 'http://localhost:3333',
        expectedRPID: 'localhost',
      })
    } catch (error) {
      console.error(error)
    }

    await setCurrentRegistrationOptions(user, verification)

    return verification
  },
})
