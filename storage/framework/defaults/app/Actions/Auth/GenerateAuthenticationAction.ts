import type { PublicKeyCredentialRequestOptionsJSON } from '@stacksjs/auth'
import { Action } from '@stacksjs/actions'
import {
  generateAuthenticationOptions,
  getUserPasskeys,
} from '@stacksjs/auth'
import { config } from '@stacksjs/config'
import { User } from '@stacksjs/orm'

export default new Action({
  name: 'PasskeyAuthenticationAction',
  description: 'Generate Passkey Authentication Options',
  method: 'POST',
  async handle(request: RequestInstance) {
    const email = request.get('email')

    if (!email) {
      return Response.json({ error: 'Email is required' }, { status: 422 })
    }

    const user = await User.where('email', email).first()

    if (!user) {
      return Response.json({ error: 'User not found' }, { status: 404 })
    }

    const userPasskeys = await getUserPasskeys(user.id as number)

    // Use configured app URL for rpID instead of hardcoded localhost
    const appUrl = config.app?.url || 'localhost'
    const rpID = new URL(appUrl.startsWith('http') ? appUrl : `https://${appUrl}`).hostname

    const options: PublicKeyCredentialRequestOptionsJSON = await generateAuthenticationOptions({
      rpID,
      allowCredentials: userPasskeys.map(passkey => ({
        id: passkey.id,
        transports: ['internal'],
      })),
    })

    return options
  },
})
