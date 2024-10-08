import { Action } from '@stacksjs/actions'
import { generateRegistrationOptions, getUserPasskeys } from '@stacksjs/auth'
import type { RequestInstance } from '@stacksjs/types'
import User from '../../storage/framework/orm/src/models/User.ts'

export default new Action({
  name: 'PasskeyRegistrationAction',
  description: 'Register a Passkey',
  method: 'POST',
  async handle(request: RequestInstance) {
    const email = request.get('email') ?? ''

    const user = await User.whereEmail(email).firstOrFail()

    if (!user) return

    const userPasskeys = getUserPasskeys(user?.id as number)

    const userEmail = user?.email ?? ''

    const options = await generateRegistrationOptions({
      rpName: 'Stacks',
      rpID: 'localhost',
      userName: userEmail,
      attestationType: 'none',
      excludeCredentials: userPasskeys.map((passkey) => ({
        id: passkey.id,
        transports: passkey.transports,
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
