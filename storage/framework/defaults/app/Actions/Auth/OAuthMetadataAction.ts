import { Action } from '@stacksjs/actions/runtime'
import { oauthAuthorizationServerMetadata, resolveOAuthProviderConfig } from '@stacksjs/auth'
import { config } from '@stacksjs/config'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'OAuthMetadataAction',
  description: 'Publish OAuth authorization-server metadata',
  method: 'GET',

  async handle() {
    const provider = resolveOAuthProviderConfig(config.auth.oauthProvider)
    if (!provider)
      return response.notFound('OAuth provider is not enabled')

    return response.json(oauthAuthorizationServerMetadata(provider), {
      headers: { 'Cache-Control': 'public, max-age=300' },
    })
  },
})
