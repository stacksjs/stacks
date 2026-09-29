import { Action } from '@stacksjs/actions'
import {
  OAuthClientRegistrationError,
  registerOAuthClient,
  resolveOAuthProviderConfig,
} from '@stacksjs/auth'
import { config } from '@stacksjs/config'
import { response } from '@stacksjs/router'
import { oauthPositiveId, oauthStringList } from './oauth-request'

export default new Action({
  name: 'OAuthClientStoreAction',
  description: 'Register an OAuth client for the authenticated user',
  method: 'POST',

  async handle(request: RequestInstance) {
    const provider = resolveOAuthProviderConfig(config.auth.oauthProvider)
    if (!provider)
      return response.notFound('OAuth provider is not enabled')

    const user = await request.user()
    const ownerId = user ? oauthPositiveId(user.id) : null
    if (!ownerId)
      return response.unauthorized('Authentication required')

    const body = await request.all() as Record<string, unknown>
    const name = typeof body.name === 'string' ? body.name : null
    const type = body.type === 'public' || body.type === 'confidential' ? body.type : null
    const redirectUris = oauthStringList(body.redirect_uris)
    const scopes = oauthStringList(body.scopes)
    const resources = oauthStringList(body.resources)
    if (!name || !type || !redirectUris || !scopes || !resources)
      return response.badRequest('OAuth client registration metadata is invalid')

    try {
      const result = await registerOAuthClient(provider, ownerId, {
        name,
        type,
        tokenEndpointAuthMethod: type === 'public' ? 'none' : 'client_secret_basic',
        redirectUris,
        grantTypes: ['authorization_code', 'refresh_token'],
        scopes,
        resources,
      })

      return response.json({
        client: {
          id: result.client.id,
          name: result.client.name,
          type: result.client.type,
          token_endpoint_auth_method: result.client.tokenEndpointAuthMethod,
          redirect_uris: result.client.redirectUris,
          grant_types: result.client.grantTypes,
          scopes: result.client.scopes,
          resources: result.client.resources,
          created_at: result.client.createdAt.toISOString(),
        },
        ...(result.plainTextSecret ? { client_secret: result.plainTextSecret } : {}),
      }, {
        status: 201,
        headers: {
          'Cache-Control': 'no-store',
          'Pragma': 'no-cache',
        },
      })
    }
    catch (error) {
      if (error instanceof OAuthClientRegistrationError)
        return response.json({ message: error.message }, { status: 422 })
      throw error
    }
  },
})
