import { Action } from '@stacksjs/actions'
import { handleOAuthTokenRequest, resolveOAuthProviderConfig } from '@stacksjs/auth'
import { config } from '@stacksjs/config'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'OAuthTokenAction',
  description: 'Exchange OAuth authorization codes and refresh tokens',
  method: 'POST',
  // OAuth clients authenticate with PKCE or HTTP Basic and cannot obtain the
  // browser CSRF cookie. The protocol boundary validates its own credentials.
  skipCsrf: true,

  async handle(request: RequestInstance) {
    const provider = resolveOAuthProviderConfig(config.auth.oauthProvider)
    if (!provider)
      return response.notFound('OAuth provider is not enabled')

    return handleOAuthTokenRequest(provider, {
      body: (await request.rawBody?.()) ?? '',
      contentType: request.headers.get('content-type'),
      authorization: request.headers.get('authorization'),
    })
  },
})
