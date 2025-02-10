import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { setCurrentRegistrationOptions, verifyRegistrationResponse } from '@stacksjs/auth'
import { User } from '@stacksjs/orm'

export default new Action({
  name: 'VerifyRegistrationAction',
  description: 'Verify the registration passkey',
  method: 'POST',
  async handle(request: RequestInstance) {
    const body = request.all()

    const email = request.get('email') ?? ''

    const user = await User.where('email', email).first()

    if (!user)
      return

    try {
      const verification = await verifyRegistrationResponse({
        response: body.attResp,
        expectedChallenge: body.challenge,
        expectedOrigin: 'http://localhost:3333',
        expectedRPID: 'localhost',
      })

      await setCurrentRegistrationOptions(user, verification)

      console.log(verification)
      return verification
    }
    catch (error) {
      console.error(error)
    }

    return user
  },
})
