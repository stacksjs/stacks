import { Action } from '@stacksjs/actions/runtime'
import {
  handleOAuthAuthorizationConsentRequest,
  resolveOAuthConsentWorkspace,
  resolveOAuthProviderConfig,
} from '@stacksjs/auth'
import { config } from '@stacksjs/config'
import { response } from '@stacksjs/router'
import { oauthPositiveId } from './oauth-request'

export default new Action({
  name: 'OAuthConsentAction',
  description: 'Approve or deny an OAuth authorization request',
  method: 'POST',

  async handle(request: RequestInstance) {
    const provider = resolveOAuthProviderConfig(config.auth.oauthProvider)
    if (!provider)
      return response.notFound('OAuth provider is not enabled')

    // Check `user` itself rather than only through `id`, so the workspace
    // resolver below sees a narrowed user instead of `AuthenticatedUser | undefined`.
    const user = await request.user()
    if (!user)
      return response.unauthorized('Authentication required')
    const id = oauthPositiveId(user.id)
    if (!id)
      return response.unauthorized('Authentication required')

    return handleOAuthAuthorizationConsentRequest({
      provider,
      request: request as unknown as Request,
      subjectType: 'users',
      subjectId: id,
      resolveWorkspaceId: async () => (await resolveOAuthConsentWorkspace(provider, { request, user }))?.id ?? null,
    })
  },
})
