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
      // The WebAuthn user handle. It was omitted entirely, and the generator
      // does `new TextEncoder().encode(options.userID)` - so every passkey was
      // registered against the handle "undefined", the same one for every
      // user. `storePasskey` records the email as `webauthn_user_id`, so the
      // email is the handle the two halves have to agree on.
      userID: userEmail,
      userName: userEmail,
      attestationType: 'none',
      // `id` is the base64url string the passkey is stored under, which is
      // what has to travel in JSON - an ArrayBuffer serializes to `{}`. The
      // installed @stacksjs/ts-auth types it as ArrayBuffer only; fixed
      // upstream (ts-auth b59ad36), so this narrowing goes away with the next
      // release of that package.
      excludeCredentials: userPasskeys.map(passkey => ({
        id: passkey.id,
        type: 'public-key' as const,
        transports: ['internal'],
      })) as unknown as Parameters<typeof generateRegistrationOptions>[0]['excludeCredentials'],
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
