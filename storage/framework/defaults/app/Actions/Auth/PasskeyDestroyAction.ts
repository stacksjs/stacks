import { Action } from '@stacksjs/actions/runtime'
import { verifyHash } from '@stacksjs/security'
import { removePasskey } from '@stacksjs/auth'
import { passkeyParty, passkeyFailure, passkeyJSON } from './passkey-config'

export default new Action({
  name: 'PasskeyDestroy',
  method: 'DELETE',
  async handle(request) {
    const party = passkeyParty()
    if (!party) return new Response(null, { status: 404 })
    try {
      const user = await request.user()
      if (!user) return new Response(null, { status: 401 })
      const id = request.getParam('id')
      if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,1366}$/.test(id)) return new Response(null, { status: 422 })
      return await removePasskey(Number(user.id), id, async row => {
        const password = request.get('password')
        return typeof password === 'string' && !!password && typeof row.password === 'string' && await verifyHash(password, row.password)
      }) ? passkeyJSON({ ok: true }) : new Response(null, { status: 404 })
    }
    catch (error) { return passkeyFailure(error) }
  },
})
