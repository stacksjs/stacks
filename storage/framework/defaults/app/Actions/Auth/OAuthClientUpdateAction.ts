import { Action } from '@stacksjs/actions/runtime'
import {
  OAuthClientRegistrationError,
  resolveOAuthProviderConfig,
  updateOAuthClient,
} from '@stacksjs/auth'
import { config } from '@stacksjs/config'
import { response } from '@stacksjs/router'
import { oauthPositiveId, oauthStringList } from './oauth-request'

export default new Action({
  name: 'OAuthClientUpdateAction',
  description: 'Update an OAuth client owned by the authenticated user',
  method: 'PATCH',

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

    const body = await request.all() as Record<string, unknown>
    const name = typeof body.name === 'string' ? body.name : null
    const redirectUris = body.redirect_uris === undefined ? [] : oauthStringList(body.redirect_uris)
    const grantTypes = body.grant_types === undefined
      ? ['authorization_code', 'refresh_token']
      : oauthStringList(body.grant_types)
    const scopes = oauthStringList(body.scopes)
    const resources = oauthStringList(body.resources)
    if (!name || !redirectUris || !grantTypes || !scopes || !resources)
      return response.badRequest('OAuth client update metadata is invalid')

    try {
      const client = await updateOAuthClient(provider, ownerId, clientId, {
        name,
        redirectUris,
        grantTypes,
        scopes,
        resources,
      })
      if (!client)
        return response.notFound('OAuth client not found')

      return response.json({
        client: {
          id: client.id,
          name: client.name,
          type: client.type,
          token_endpoint_auth_method: client.tokenEndpointAuthMethod,
          redirect_uris: client.redirectUris,
          grant_types: client.grantTypes,
          scopes: client.scopes,
          resources: client.resources,
          revoked: client.revoked,
          created_at: client.createdAt.toISOString(),
        },
      }, {
        headers: { 'Cache-Control': 'no-store' },
      })
    }
    catch (error) {
      if (error instanceof OAuthClientRegistrationError)
        return response.json({ message: error.message }, { status: 422 })
      throw error
    }
  },
})
