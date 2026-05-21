import { Action } from '@stacksjs/actions'
import { generateRegistrationOptions, getUserPasskeys, storeWebAuthnChallenge } from '@stacksjs/auth'
import { config } from '@stacksjs/config'
import { User } from '@stacksjs/orm'

export default new Action({
  name: 'PasskeyRegistrationAction',
  description: 'Generate Passkey Registration Options',
  method: 'POST',
  async handle(request: RequestInstance) {
    const email = request.get('email') ?? ''

    const user = await User.where('email', email).firstOrFail()

    if (!user)
      return Response.json({ error: 'User not found' }, { status: 404 })

    const userPasskeys = await getUserPasskeys(user?.id as number)
    const userEmail = user?.email ?? ''

    // Use configured app URL for rpID instead of hardcoded localhost
    const appUrl = config.app?.url || 'localhost'
    const rpID = new URL(appUrl.startsWith('http') ? appUrl : `https://${appUrl}`).hostname
    const rpName = config.app?.name || 'Stacks'

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userName: userEmail,
      attestationType: 'none',
      excludeCredentials: userPasskeys.map(passkey => ({
        id: passkey.id,
        transports: ['internal'],
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
        authenticatorAttachment: 'platform',
      },
    })

    // Persist the challenge server-side so VerifyRegistrationAction
    // can consume it instead of trusting `body.challenge`. See
    // stacksjs/stacks#1866.
    await storeWebAuthnChallenge(user.id as number, options.challenge, 'registration')

    return options
  },
})
