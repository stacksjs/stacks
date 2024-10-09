import { Action } from '@stacksjs/actions'
import { getUserPasskeys, setCurrentRegistrationOptions, verifyRegistrationResponse } from '@stacksjs/auth'
import type { RequestInstance } from '@stacksjs/types'
import User from '../../../storage/framework/orm/src/models/User.ts'

export default new Action({
  name: 'PasskeyRegistrationAction',
  description: 'Register a Passkey',
  method: 'POST',
  async handle(request: RequestInstance) {
    const body = request.all()

    const email = request.get('email') ?? ''

    const user = await User.where('email', email).first()

    if (!user) return

    try {
      const verification = await verifyRegistrationResponse({
        response: body.attResp,
        expectedChallenge: body.challenge,
        expectedOrigin: 'http://localhost:3333',
        expectedRPID: 'localhost',
      })

      await setCurrentRegistrationOptions(user, verification)

      return verification
    } catch (error) {
      console.error(error)
    }

    return user
  },
})
