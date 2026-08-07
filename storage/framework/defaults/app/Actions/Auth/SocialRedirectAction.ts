import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'
import { isSocialProviderConfigured, socialProvider } from '@stacksjs/socials'

/**
 * `GET /auth/{provider}` — send the browser to the provider's consent page
 * (stacksjs/stacks#2276).
 *
 * A provider that is not fully configured 404s rather than redirecting into a
 * half-built OAuth flow: the sign-in page renders its buttons from
 * `configuredSocialProviders()`, so a visitor only reaches this with a name
 * that works — anything else is URL guessing.
 */
export default new Action({
  name: 'SocialRedirectAction',
  description: 'Redirects the browser to a social provider\'s OAuth consent page.',
  method: 'GET',

  async handle(request: RequestInstance) {
    const provider = String(request.getParam('provider') ?? '').toLowerCase()

    if (!isSocialProviderConfigured(provider))
      return response.notFound(`Social provider "${provider}" is not configured.`)

    const driver = socialProvider(provider)
    if (!driver)
      return response.notFound(`Social provider "${provider}" is not configured.`)

    return new Response(null, {
      status: 302,
      headers: {
        'Location': await driver.getAuthUrl(),
        'Cache-Control': 'no-store',
      },
    })
  },
})
