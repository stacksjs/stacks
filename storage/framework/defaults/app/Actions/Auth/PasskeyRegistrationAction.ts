import { Action } from '@stacksjs/actions/runtime'
import { finishPasskeyRegistration } from '@stacksjs/auth'
import { passkeyParty, passkeyFailure, passkeyJSON } from './passkey-config'

export default new Action({
  name: 'PasskeyRegistration',
  method: 'POST',
  async handle(request) {
    const party = passkeyParty()
    if (!party) return new Response(null, { status: 404 })
    try {
      const user = await request.user()
      if (!user) return new Response(null, { status: 401 })
      const body = request.all()
      await finishPasskeyRegistration(Number(user.id), body.ceremony, body.credential, party)
      return passkeyJSON({ ok: true })
    }
    catch (error) { return passkeyFailure(error) }
  },
})
