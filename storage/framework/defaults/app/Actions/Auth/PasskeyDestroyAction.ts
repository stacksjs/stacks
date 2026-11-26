import { Action } from '@stacksjs/actions/runtime'
import { verifyHash } from '@stacksjs/security'
import { PasskeyError, removePasskey } from '@stacksjs/auth'
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
      // The password proves another way in. A wrong one is its own answer:
      // reported as "add a password first", it sent an owner who has one
      // looking for a setting rather than retyping it.
      let wrongPassword = false
      return await removePasskey(Number(user.id), id, async row => {
        if (typeof row.password !== 'string' || !row.password) return false
        const password = request.get('password')
        const proved = typeof password === 'string' && !!password && await verifyHash(password, row.password)
        wrongPassword = !proved
        return proved
      }).catch((error) => {
        if (wrongPassword && error instanceof PasskeyError)
          return Response.json({ error: 'The password is not right.' }, { status: 422, headers: { 'Cache-Control': 'no-store' } })
        throw error
      }).then(removed => removed instanceof Response ? removed : removed ? passkeyJSON({ ok: true }) : new Response(null, { status: 404 }))
    }
    catch (error) { return passkeyFailure(error) }
  },
})
