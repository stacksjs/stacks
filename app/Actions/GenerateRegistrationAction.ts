import { Action } from '@stacksjs/actions'
import { generateRegistrationOptions } from '@stacksjs/auth'
import type { RequestInstance } from '@stacksjs/types'
import User from '../../storage/framework/orm/src/models/User.ts'

export default new Action({
  name: 'PasskeyRegistrationAction',
  description: 'Register a Passkey',
  method: 'POST',
  async handle(request: RequestInstance) {
    const email = request.get('email') ?? ''

    const userPasskeys: any[] = [
      { id: 'passkey1', transports: ['usb'] },
      { id: 'passkey2', transports: ['nfc'] },
    ]

    const user = await User.whereEmail(email)

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
