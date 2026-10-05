import { Action } from '@stacksjs/actions/runtime'
import { listOAuthConnections, resolveOAuthProviderConfig } from '@stacksjs/auth'
import { config } from '@stacksjs/config'
import { response } from '@stacksjs/router'
import { oauthPositiveId } from './oauth-request'

export default new Action({
  name: 'OAuthConnectionsAction',
  description: 'List OAuth applications connected to the authenticated user',
  method: 'GET',

  async handle(request: RequestInstance) {
    const provider = resolveOAuthProviderConfig(config.auth.oauthProvider)
    if (!provider)
      return response.notFound('OAuth provider is not enabled')

    const user = await request.user()
    const id = user ? oauthPositiveId(user.id) : null
    if (!id)
      return response.unauthorized('Authentication required')

    const connections = await listOAuthConnections('users', id)

    return response.json({
      connections: connections.map(connection => ({
        grant_id: connection.grantId,
        client_id: connection.clientId,
        client_name: connection.clientName,
        scopes: connection.scopes,
        resources: connection.resources,
        audiences: connection.audiences,
        workspace_id: connection.workspaceId,
        created_at: connection.createdAt.toISOString(),
      })),
      count: connections.length,
    }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  },
})
