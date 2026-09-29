import type { OAuthAuthorizationConsentPageContext } from '@stacksjs/auth'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { Action } from '@stacksjs/actions'
import { resolveDefaultsResources } from '@stacksjs/actions/dev/defaults-resources'
import {
  authenticatedUser,
  authUser,
  handleOAuthAuthorizationPageRequest,
  resolveOAuthConsentWorkspace,
  resolveOAuthProviderConfig,
} from '@stacksjs/auth'
import { config } from '@stacksjs/config'
import { path } from '@stacksjs/path'
import { getCurrentRequest, response } from '@stacksjs/router'
import { oauthPositiveId } from './oauth-request'

function identityLabel(user: { email: string, [key: string]: unknown }): string {
  const name = typeof user.name === 'string' ? user.name.trim() : ''
  return name || user.email.trim()
}

async function renderConsentView(
  view: string,
  context: OAuthAuthorizationConsentPageContext,
): Promise<string> {
  const relative = view.endsWith('.stx') ? view : `${view}.stx`
  const applicationView = path.userViewsPath(relative)
  const frameworkView = join(resolveDefaultsResources(), 'views', relative)
  const template = existsSync(applicationView) ? applicationView : frameworkView
  const { renderTemplate } = await import('@stacksjs/stx')

  return String(await renderTemplate(template, {
    // Spread into a literal: an interface has no index signature, so it is
    // not a Record<string, unknown> until it becomes an object literal.
    context: { ...context },
    injectCSS: true,
    templateOnly: true,
    processClientScripts: false,
  }))
}

export default new Action({
  name: 'OAuthAuthorizationAction',
  description: 'Start or resume an OAuth authorization request',
  method: 'GET',

  async handle(request: RequestInstance) {
    const provider = resolveOAuthProviderConfig(config.auth.oauthProvider)
    if (!provider)
      return response.notFound('OAuth provider is not enabled')

    // This GET route must stay public so an anonymous browser can persist the
    // request before login. `request.user()` only exposes identity populated
    // by auth middleware, which this route deliberately cannot use, so fall
    // through to the lazy cookie/bearer resolver after honoring a directly
    // injected action-test or upstream middleware identity.
    const user = await authenticatedUser(request)
      ?? (getCurrentRequest() ? await authUser() : undefined)
    const subjectId = user ? oauthPositiveId(user.id) : null
    const workspace = user && subjectId
      ? await resolveOAuthConsentWorkspace(provider, { request, user })
      : null
    const resolveWorkspaceId = user
      ? async () => (await resolveOAuthConsentWorkspace(provider, { request, user }))?.id ?? null
      : undefined
    return handleOAuthAuthorizationPageRequest({
      provider,
      request: request as unknown as Request,
      identity: user ? { label: identityLabel(user), workspaceLabel: workspace?.label } : null,
      subject: subjectId
        ? {
            type: 'users',
            id: subjectId,
            workspaceId: workspace?.id,
            resolveWorkspaceId,
          }
        : null,
      csrfToken: (request as unknown as { _csrfToken?: string })._csrfToken,
      dependencies: { render: renderConsentView },
    })
  },
})
