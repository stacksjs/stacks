import { Action } from '@stacksjs/actions/runtime'
import { handleOAuthIntrospectionRequest, resolveOAuthProviderConfig } from '@stacksjs/auth'
import { config } from '@stacksjs/config'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'OAuthIntrospectionAction',
  description: 'Introspect a delegated OAuth token',
  method: 'POST',
  // Resource servers authenticate with their registered OAuth client instead
  // of a browser session, so this protocol endpoint does not use CSRF.
  skipCsrf: true,

  async handle(request: RequestInstance) {
    const provider = resolveOAuthProviderConfig(config.auth.oauthProvider)
    if (!provider || !provider.introspection)
      return response.notFound('OAuth introspection is not enabled')

    return handleOAuthIntrospectionRequest(provider, {
      body: (await request.rawBody?.()) ?? '',
      contentType: request.headers.get('content-type'),
      authorization: request.headers.get('authorization'),
    })
  },
})
