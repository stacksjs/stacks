import { Action } from '@stacksjs/actions/runtime'
import { finishPasskeyAuthentication, Auth, resolveBrowserSessionPolicy, authCookieForBrowserSession } from '@stacksjs/auth'
import { passkeyParty, passkeyFailure } from './passkey-config'

export default new Action({
  name: 'PasskeyAuthentication',
  method: 'POST',
  async handle(request) {
    const party = passkeyParty()
    if (!party) return new Response(null, { status: 404 })
    if (request.headers.get('origin') !== new URL(party.origin).origin) return new Response(null, { status: 403 })
    try {
      const body = request.all()
      const id = await finishPasskeyAuthentication(body.ceremony, body.credential, party)
      const policy = resolveBrowserSessionPolicy(body.remember)
      const session = await Auth.loginUsingId(id, { expiresInMinutes: policy.expiresInMinutes, withRefreshToken: policy.withRefreshToken })
      if (!session) return new Response(null, { status: 401 })
      return Response.json({ token: session.token, user: { id: session.user?.id, email: session.user?.email, name: session.user?.name }, expires_in: session.expiresIn, remembered: policy.remembered },
        { headers: { 'Cache-Control': 'no-store', 'Set-Cookie': authCookieForBrowserSession(session.token, session.expiresIn) } })
    }
    catch (error) { return passkeyFailure(error) }
  },
})
