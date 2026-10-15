import { Action } from '@stacksjs/actions/runtime'
import { beginPasskeyAuthentication } from '@stacksjs/auth'
import { passkeyParty, passkeyFailure, passkeyJSON } from './passkey-config'

export default new Action({
  name: 'PasskeyAuthenticationOptions',
  method: 'POST',
  async handle(request) {
    const party = passkeyParty()
    if (!party) return new Response(null, { status: 404 })
    if (request.headers.get('origin') !== new URL(party.origin).origin) return new Response(null, { status: 403 })
    try {
      return passkeyJSON(await beginPasskeyAuthentication(party))
    }
    catch (error) { return passkeyFailure(error) }
  },
})
