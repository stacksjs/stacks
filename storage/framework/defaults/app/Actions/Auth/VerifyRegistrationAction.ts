import { Action } from '@stacksjs/actions'
import { setCurrentRegistrationOptions, verifyRegistrationResponse } from '@stacksjs/auth'
import { config } from '@stacksjs/config'
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
      return Response.json({ error: 'User not found' }, { status: 404 })

    // Derive origin and rpID from app config instead of hardcoding localhost
    const appUrl = config.app?.url || 'http://localhost:3333'
    const expectedOrigin = appUrl.startsWith('http') ? appUrl : `https://${appUrl}`
    const expectedRPID = new URL(expectedOrigin).hostname

    try {
      const verification = await verifyRegistrationResponse({
        response: body.attResp,
        expectedChallenge: body.challenge,
        expectedOrigin,
        expectedRPID,
      })

      await setCurrentRegistrationOptions(user, verification)

      return verification
    }
    catch (error) {
      console.error('Passkey verification failed:', error)
      return Response.json({ error: 'Registration verification failed' }, { status: 400 })
    }
  },
})
