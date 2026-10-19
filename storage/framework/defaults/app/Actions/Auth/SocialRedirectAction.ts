import { Buffer } from 'node:buffer'
import { randomBytes } from 'node:crypto'
import { Action } from '@stacksjs/actions/runtime'
import { response } from '@stacksjs/router'
import { isSocialProviderConfigured, issueOAuthFlow, SOCIAL_PROVIDERS, socialProvider } from '@stacksjs/socials'
import { safeSocialReturnPath, SOCIAL_FLOW_TTL_MS, socialFlowCookieOptions, socialFlowPurpose } from './social-flow'

/**
 * `GET /auth/{provider}` — send the browser to the provider's consent page
 * (stacksjs/stacks#2276).
 *
 * A provider that is not fully configured 404s rather than redirecting into a
 * half-built OAuth flow: the sign-in page renders its buttons from
 * `configuredSocialProviders()`, so a visitor only reaches this with a name
 * that works — anything else is URL guessing.
 *
 * The `state` in the provider URL comes from `issueOAuthFlow()`: single use,
 * ten minutes, and bound to this browser by an HttpOnly cookie, so the
 * callback can refuse a code that this browser did not ask for (login CSRF).
 * Apple's flow also carries a nonce the callback finds in the id_token, and
 * X's carries its PKCE verifier.
 *
 * `?redirect_to=/path` picks where the browser lands afterwards. Only a
 * same-origin relative path is kept; anything else lands on `/`.
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

    const descriptor = SOCIAL_PROVIDERS[provider as keyof typeof SOCIAL_PROVIDERS]
    const verifier = descriptor.pkce ? Buffer.from(randomBytes(32)).toString('base64url') : undefined
    const redirectTo = safeSocialReturnPath(request.get('redirect_to'))

    const flow = await issueOAuthFlow({
      purpose: socialFlowPurpose(provider),
      ttlMs: SOCIAL_FLOW_TTL_MS,
      nonce: descriptor.nonce,
      data: {
        ...(redirectTo && { redirectTo }),
        ...(verifier && { verifier }),
      },
      cookie: socialFlowCookieOptions(descriptor.postCallback),
    })

    driver.withState(flow.state)
    if (verifier)
      driver.withCodeVerifier(verifier)
    if (flow.nonce)
      driver.with({ nonce: flow.nonce })

    const headers = new Headers({
      'Location': await driver.getAuthUrl(),
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
    })
    if (flow.cookie)
      headers.append('Set-Cookie', flow.cookie)

    return new Response(null, { status: 302, headers })
  },
})
