import { Action } from '@stacksjs/actions'
import { generateRegistrationOptions, getUserPasskeys, storeWebAuthnChallenge } from '@stacksjs/auth'
import { config } from '@stacksjs/config'

export default new Action({
  name: 'PasskeyRegistrationAction',
  description: 'Generate Passkey Registration Options',
  method: 'POST',
  async handle(request: RequestInstance) {
    // Enrolling a passkey attaches a new login credential to an
    // account — the identity MUST come from the caller's own
    // authenticated session, never a client-supplied `email` field.
    // Trusting `request.get('email')` here let anyone who knew a
    // victim's email register a passkey against that victim's
    // account and log in as them, no password required. This route
    // must stay behind `middleware('auth')` — see routes/dashboard.ts.
    const user = await request.user()

    if (!user)
      return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const userPasskeys = await getUserPasskeys(user.id as number)
    const userEmail = user.email ?? ''

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
