import { Action } from '@stacksjs/actions'
import { disableOAuthClient, resolveOAuthProviderConfig } from '@stacksjs/auth'
import { config } from '@stacksjs/config'
import { response } from '@stacksjs/router'

function positiveId(value: number | string): number | null {
  const id = Number(value)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

export default new Action({
  name: 'OAuthClientDisableAction',
  description: 'Disable an OAuth client owned by the authenticated user',
  method: 'POST',

  async handle(request: RequestInstance) {
    const provider = resolveOAuthProviderConfig(config.auth.oauthProvider)
    if (!provider)
      return response.notFound('OAuth provider is not enabled')

    const user = await request.user()
    const ownerId = user ? positiveId(user.id) : null
    if (!ownerId)
      return response.unauthorized('Authentication required')

    const rawClientId = request.getParam('id')
    const clientId = /^\d+$/.test(rawClientId) ? positiveId(rawClientId) : null
    if (!clientId)
      return response.badRequest('Invalid OAuth client ID')

    const disabled = await disableOAuthClient(ownerId, clientId)
    if (!disabled)
      return response.notFound('OAuth client not found')

    return response.json({
      message: 'OAuth client disabled successfully',
      client_id: clientId,
    }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  },
})
