import { Action } from '@stacksjs/actions'
import { listOAuthClients, resolveOAuthProviderConfig } from '@stacksjs/auth'
import { config } from '@stacksjs/config'
import { response } from '@stacksjs/router'

function ownerId(value: number | string): number | null {
  const id = Number(value)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

export default new Action({
  name: 'OAuthClientsAction',
  description: 'List OAuth clients owned by the authenticated user',
  method: 'GET',

  async handle(request: RequestInstance) {
    const provider = resolveOAuthProviderConfig(config.auth.oauthProvider)
    if (!provider)
      return response.notFound('OAuth provider is not enabled')

    const user = await request.user()
    const id = user ? ownerId(user.id) : null
    if (!id)
      return response.unauthorized('Authentication required')

    const clients = await listOAuthClients(id)

    return response.json({
      clients: clients.map(client => ({
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
      })),
      count: clients.length,
    }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  },
})
