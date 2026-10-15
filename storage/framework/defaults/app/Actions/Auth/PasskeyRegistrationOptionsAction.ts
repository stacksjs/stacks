import { Action } from '@stacksjs/actions/runtime'
import { beginPasskeyRegistration } from '@stacksjs/auth'
import { passkeyParty, passkeyFailure, passkeyJSON } from './passkey-config'

export default new Action({
  name: 'PasskeyRegistrationOptions',
  method: 'POST',
  async handle(request) {
    const party = passkeyParty()
    if (!party) return new Response(null, { status: 404 })
    try {
      const user = await request.user()
      if (!user) return new Response(null, { status: 401 })
      return passkeyJSON(await beginPasskeyRegistration({ id: Number(user.id), email: user.email, name: user.name }, party))
    }
    catch (error) { return passkeyFailure(error) }
  },
})
