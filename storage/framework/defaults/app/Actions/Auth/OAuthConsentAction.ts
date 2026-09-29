import { Action } from '@stacksjs/actions'
import { handleOAuthAuthorizationConsentRequest, resolveOAuthProviderConfig } from '@stacksjs/auth'
import { config } from '@stacksjs/config'
import { response } from '@stacksjs/router'

function subjectId(value: number | string): number | null {
  const id = Number(value)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

export default new Action({
  name: 'OAuthConsentAction',
  description: 'Approve or deny an OAuth authorization request',
  method: 'POST',

  async handle(request: RequestInstance) {
    const provider = resolveOAuthProviderConfig(config.auth.oauthProvider)
    if (!provider)
      return response.notFound('OAuth provider is not enabled')

    const user = await request.user()
    const id = user ? subjectId(user.id) : null
    if (!id)
      return response.unauthorized('Authentication required')

    return handleOAuthAuthorizationConsentRequest({
      provider,
      request: request as unknown as Request,
      subjectType: 'users',
      subjectId: id,
    })
  },
})
