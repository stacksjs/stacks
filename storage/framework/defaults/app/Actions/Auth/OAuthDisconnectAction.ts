import { Action } from '@stacksjs/actions/runtime'
import { disconnectOAuthGrant, resolveOAuthProviderConfig } from '@stacksjs/auth'
import { config } from '@stacksjs/config'
import { response } from '@stacksjs/router'
import { oauthPositiveId } from './oauth-request'

export default new Action({
  name: 'OAuthDisconnectAction',
  description: 'Disconnect an OAuth application from the authenticated user',
  method: 'POST',

  async handle(request: RequestInstance) {
    const provider = resolveOAuthProviderConfig(config.auth.oauthProvider)
    if (!provider)
      return response.notFound('OAuth provider is not enabled')

    const user = await request.user()
    const id = user ? oauthPositiveId(user.id) : null
    if (!id)
      return response.unauthorized('Authentication required')

    const grantId = request.getParam('id')
    if (!/^[a-f0-9]{32}$/.test(grantId))
      return response.badRequest('Invalid OAuth grant ID')

    const disconnected = await disconnectOAuthGrant('users', id, grantId)
    if (!disconnected)
      return response.notFound('OAuth connection not found')

    return response.json({
      message: 'OAuth application disconnected successfully',
      grant_id: grantId,
    }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  },
})
