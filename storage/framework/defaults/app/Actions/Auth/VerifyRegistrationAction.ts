import { Action } from '@stacksjs/actions'
import {
  consumeWebAuthnChallenge,
  setCurrentRegistrationOptions,
  verifyRegistrationResponse,
} from '@stacksjs/auth'
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

    // Read + delete the server-stored registration challenge for this
    // user. The previous flow accepted `body.challenge` from the
    // client; persisting it here closes the same replay vector that
    // the authentication path closed in stacksjs/stacks#1866.
    const expectedChallenge = await consumeWebAuthnChallenge(user.id as number, 'registration')
    if (!expectedChallenge) {
      return Response.json(
        { error: 'Registration challenge missing or expired — please retry from the start.' },
        { status: 401 },
      )
    }

    // Derive origin and rpID from app config instead of hardcoding localhost
    const appUrl = config.app?.url || 'http://localhost:3333'
    const expectedOrigin = appUrl.startsWith('http') ? appUrl : `https://${appUrl}`
    const expectedRPID = new URL(expectedOrigin).hostname

    try {
      const verification = await verifyRegistrationResponse({
        response: body.attResp,
        expectedChallenge,
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
