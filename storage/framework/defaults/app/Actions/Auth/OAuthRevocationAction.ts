import { Action } from '@stacksjs/actions/runtime'
import { handleOAuthRevocationRequest, resolveOAuthProviderConfig } from '@stacksjs/auth'
import { config } from '@stacksjs/config'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'OAuthRevocationAction',
  description: 'Revoke a delegated OAuth token',
  method: 'POST',
  // OAuth clients authenticate with their registered protocol method instead
  // of a browser session, so they cannot and must not need a CSRF cookie.
  skipCsrf: true,

  async handle(request: RequestInstance) {
    if (!resolveOAuthProviderConfig(config.auth.oauthProvider))
      return response.notFound('OAuth provider is not enabled')

    return handleOAuthRevocationRequest({
      body: (await request.rawBody?.()) ?? '',
      contentType: request.headers.get('content-type'),
      authorization: request.headers.get('authorization'),
    })
  },
})
