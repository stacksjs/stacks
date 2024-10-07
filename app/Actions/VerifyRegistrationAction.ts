import { verifyRegistrationResponse } from '@simplewebauthn/server'
import { Action } from '@stacksjs/actions'
import type { RequestInstance } from '@stacksjs/types'

export default new Action({
  name: 'PasskeyRegistrationAction',
  description: 'Register a Passkey',
  method: 'POST',
  async handle(request: RequestInstance) {
    const body = request.all()

    let verification

    try {
      verification = await verifyRegistrationResponse({
        response: body.attResp,
        expectedChallenge: body.challenge,
        expectedOrigin: 'http://localhost:3333',
        expectedRPID: 'localhost',
      })
    } catch (error) {
      console.error(error)
    }

    return verification
  },
})
