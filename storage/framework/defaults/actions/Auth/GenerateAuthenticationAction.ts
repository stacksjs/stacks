import type { PublicKeyCredentialRequestOptionsJSON } from '@stacksjs/auth'
import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import {
  generateAuthenticationOptions,
  getUserPasskeys,

} from '@stacksjs/auth'
import { User } from '@stacksjs/orm'

export default new Action({
  name: 'PasskeyRegistrationAction',
  description: 'Register a Passkey',
  method: 'POST',
  async handle(request: RequestInstance) {
    const email = request.get('email')

    const user = await User.where('email', email).first()

    const userPasskeys = await getUserPasskeys(user?.id as number)

    const options: PublicKeyCredentialRequestOptionsJSON = await generateAuthenticationOptions({
      rpID: 'localhost',
      // Require users to use a previously-registered authenticator
      allowCredentials: userPasskeys.map(passkey => ({
        id: passkey.id,
        transports: ['internal'],
      })),
    })

    return options
  },
})
