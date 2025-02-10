import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { generateRegistrationOptions, getUserPasskeys } from '@stacksjs/auth'
import { User } from '@stacksjs/orm'

export default new Action({
  name: 'PasskeyRegistrationAction',
  description: 'Register a Passkey',
  method: 'POST',
  async handle(request: RequestInstance) {
    const email = request.get('email') ?? ''

    const user = await User.where('email', email).firstOrFail()

    if (!user)
      return

    const userPasskeys = await getUserPasskeys(user?.id as number)

    const userEmail = user?.email ?? ''

    const options = await generateRegistrationOptions({
      rpName: 'Stacks',
      rpID: 'localhost',
      userName: userEmail,
      attestationType: 'none',
      excludeCredentials: userPasskeys.map(passkey => ({
        id: passkey.id,
        transports: ['internal'], // TODO: Dynamic
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
        authenticatorAttachment: 'platform',
      },
    })

    return options
  },
})
