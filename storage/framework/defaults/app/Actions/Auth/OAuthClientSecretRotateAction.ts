import { Action } from '@stacksjs/actions/runtime'
import { resolveOAuthProviderConfig, rotateOAuthClientSecret } from '@stacksjs/auth'
import { config } from '@stacksjs/config'
import { response } from '@stacksjs/router'
import { oauthPositiveId } from './oauth-request'

export default new Action({
  name: 'OAuthClientSecretRotateAction',
  description: 'Rotate an OAuth client secret owned by the authenticated user',
  method: 'POST',

  async handle(request: RequestInstance) {
    const provider = resolveOAuthProviderConfig(config.auth.oauthProvider)
    if (!provider)
      return response.notFound('OAuth provider is not enabled')

    const user = await request.user()
    const ownerId = user ? oauthPositiveId(user.id) : null
    if (!ownerId)
      return response.unauthorized('Authentication required')

    const rawClientId = request.getParam('id')
    const clientId = /^\d+$/.test(rawClientId) ? oauthPositiveId(rawClientId) : null
    if (!clientId)
      return response.badRequest('Invalid OAuth client ID')

    const clientSecret = await rotateOAuthClientSecret(ownerId, clientId)
    if (!clientSecret)
      return response.notFound('OAuth client not found')

    return response.json({
      client_id: clientId,
      client_secret: clientSecret,
    }, {
      headers: {
        'Cache-Control': 'no-store',
        'Pragma': 'no-cache',
      },
    })
  },
})
