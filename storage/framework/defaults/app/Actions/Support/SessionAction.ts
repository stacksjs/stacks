import { Action } from '@stacksjs/actions/runtime'
import { config, overridesReady } from '@stacksjs/config'
import { createAuthenticatedSupportSession, createSupportClient } from '@stacksjs/support/server'

export default new Action({
  name: 'Create an identified native support session', method: 'POST', apiResponse: false,
  async handle(request) {
    await overridesReady
    const service = config.services.supporthq
    if (service?.enabled !== true || !service.key || !service.project) return Response.json({ error: { code: 'support_disabled' } }, { status: 404 })
    const user = await request.user()
    if (!user) return Response.json({ error: { code: 'unauthorized' } }, { status: 401 })
    try {
      const client = createSupportClient({ url: service.url, key: service.key, project: service.project })
      const session = await createAuthenticatedSupportSession(client, request, { expose: service.expose })
      return Response.json({ token: session.token, expiresAt: session.expiresAt }, { headers: { 'Cache-Control': 'private, no-store' } })
    }
    catch { return Response.json({ error: { code: 'support_unavailable' } }, { status: 503, headers: { 'Cache-Control': 'no-store' } }) }
  },
})
