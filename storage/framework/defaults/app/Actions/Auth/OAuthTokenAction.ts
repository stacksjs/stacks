import type { OAuthSubjectEligibility } from '@stacksjs/auth'
import { Action } from '@stacksjs/actions'
import { handleOAuthTokenRequest, resolveOAuthProviderConfig } from '@stacksjs/auth'
import { config } from '@stacksjs/config'
import { db } from '@stacksjs/database/runtime'
import { response } from '@stacksjs/router'

const isSubjectEligible: OAuthSubjectEligibility = async (subject) => {
  if (subject.type !== 'users') return false
  return Boolean(await db.primary.selectFrom('users')
    .where('id', '=', subject.id)
    .select('id')
    .executeTakeFirst())
}

export default new Action({
  name: 'OAuthTokenAction',
  description: 'Exchange OAuth authorization codes, refresh tokens, and machine credentials',
  method: 'POST',
  // OAuth clients authenticate with PKCE or HTTP Basic and cannot obtain the
  // browser CSRF cookie. The protocol boundary validates its own credentials.
  skipCsrf: true,

  async handle(request: RequestInstance) {
    const provider = resolveOAuthProviderConfig(config.auth.oauthProvider)
    if (!provider)
      return response.notFound('OAuth provider is not enabled')

    const eligible = provider.subjectEligibility ?? isSubjectEligible

    return handleOAuthTokenRequest(provider, {
      body: (await request.rawBody?.()) ?? '',
      contentType: request.headers.get('content-type'),
      authorization: request.headers.get('authorization'),
    }, { isSubjectEligible: eligible })
  },
})
