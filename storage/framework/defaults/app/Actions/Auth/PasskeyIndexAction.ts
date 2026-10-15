import { Action } from '@stacksjs/actions/runtime'
import { listPasskeys } from '@stacksjs/auth'
import { passkeyParty, passkeyFailure, passkeyJSON } from './passkey-config'

export default new Action({
  name: 'PasskeyIndex',
  method: 'GET',
  async handle(request) {
    const party = passkeyParty()
    if (!party) return new Response(null, { status: 404 })
    try {
      const user = await request.user()
      if (!user) return new Response(null, { status: 401 })
      return passkeyJSON({ passkeys: await listPasskeys(Number(user.id)) })
    }
    catch (error) { return passkeyFailure(error) }
  },
})
