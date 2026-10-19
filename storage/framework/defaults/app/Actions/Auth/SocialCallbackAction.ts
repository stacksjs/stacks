import { Action } from '@stacksjs/actions/runtime'
import { createSessionHandoff, resolveSocialSignIn, SocialSignInRefusedError } from '@stacksjs/auth'
import { log } from '@stacksjs/logging'
import { response } from '@stacksjs/router'
import {
  clearOAuthFlowCookie,
  consumeOAuthFlow,
  isSocialProviderConfigured,
  readOAuthFlowCookie,
  SOCIAL_PROVIDERS,
  socialHandoffCodeRedirect,
  socialHandoffFailureRedirect,
  socialProvider,
} from '@stacksjs/socials'
import { safeSocialReturnPath, socialFlowCookieOptions, socialFlowPurpose } from './social-flow'

/**
 * `GET|POST /auth/{provider}/callback` — complete a social sign-in
 * (stacksjs/stacks#2276).
 *
 * 1. The returned `state` must redeem the flow SocialRedirectAction started,
 *    in this browser (its HttpOnly cookie), once, within ten minutes. A code
 *    from anywhere else is refused before it is exchanged: that is the login
 *    CSRF a callback which "exchanges any code" is open to.
 * 2. The driver exchanges the code; Apple's id_token must carry the flow's
 *    nonce, X's exchange gets the flow's PKCE verifier back.
 * 3. `resolveSocialSignIn` decides which local user that is (find-or-create,
 *    refusing to link an address the provider or the local account has not
 *    verified).
 * 4. No session is minted here. The browser gets a 60-second, single-use
 *    handoff code in the fragment, bound to a new HttpOnly cookie, and
 *    `useAuth().completeSocialLogin()` redeems it at `POST /auth/handoff`
 *    (SessionHandoffAction), which answers with the session. Bearer and
 *    refresh tokens therefore never appear in a URL or in browser history.
 *
 * POST as well as GET because Apple mandates `response_mode=form_post`
 * whenever scopes are requested. On a POST only the form body is read, so a
 * query string cannot override what Apple sent.
 *
 * A refused sign-in redirects to /login with a `social_error` the page can
 * render; it is a policy decision, not an exception. Provider/exchange
 * failures land there too, with the detail in the log rather than the URL.
 */
export default new Action({
  name: 'SocialCallbackAction',
  description: 'Completes a social provider OAuth flow and hands the browser a one-use sign-in code.',
  method: 'GET',

  async handle(request: RequestInstance) {
    const provider = String(request.getParam('provider') ?? '').toLowerCase()

    if (!isSocialProviderConfigured(provider))
      return response.notFound(`Social provider "${provider}" is not configured.`)

    const driver = socialProvider(provider)
    if (!driver)
      return response.notFound(`Social provider "${provider}" is not configured.`)

    const descriptor = SOCIAL_PROVIDERS[provider as keyof typeof SOCIAL_PROVIDERS]
    const isPost = String(request.method ?? '').toUpperCase() === 'POST'
    const form = (request as { formBody?: Record<string, unknown> }).formBody
    const field = (name: string): string => {
      const value = isPost ? form?.[name] : request.get(name)
      return typeof value === 'string' ? value : ''
    }

    const state = field('state')
    const cookieOptions = socialFlowCookieOptions(descriptor.postCallback)
    // Every outcome clears the flow cookie: it is single use either way.
    const withClearedFlow = async (redirect: Response): Promise<Response> => {
      if (state)
        redirect.headers.append('Set-Cookie', await clearOAuthFlowCookie(state, cookieOptions))
      return redirect
    }
    const failure = (reason: string) => withClearedFlow(socialHandoffFailureRedirect(reason))

    const flow = await consumeOAuthFlow(state, {
      purpose: socialFlowPurpose(provider),
      browserSecret: readOAuthFlowCookie(request.headers.get('cookie'), state),
    })
    if (!flow)
      return failure('This sign-in expired or was started in another browser. Please try again.')

    if (field('error'))
      return failure('Sign-in was cancelled.')

    const code = field('code')
    if (!code)
      return failure(`${provider} did not return an authorization code.`)

    try {
      const verifier = typeof flow.data?.verifier === 'string' ? flow.data.verifier : ''
      if (verifier)
        driver.withCodeVerifier(verifier)

      const accessToken = await driver.getAccessToken(code)
      const identity = await driver.getUserByToken(accessToken, flow.nonce ? { nonce: flow.nonce } : undefined)

      if (descriptor.nonce) {
        // The driver already refuses a mismatched nonce when given one; this
        // also refuses a flow that somehow carried none.
        if (!flow.nonce || identity.raw?.nonce !== flow.nonce)
          return failure('Sign-in could not be completed. Please try again.')
        // Apple sends the name once, on the first authorization, in the form body.
        if (!identity.name)
          identity.name = appleDisplayName(field('user'))
      }

      const { userId } = await resolveSocialSignIn(provider, identity)

      const handoff = await createSessionHandoff(userId, { bindTo: 'cookie' })
      const redirectTo = safeSocialReturnPath(flow.data?.redirectTo) ?? '/'
      const redirect = socialHandoffCodeRedirect(handoff.code, { redirectTo })
      if (handoff.cookie)
        redirect.headers.append('Set-Cookie', handoff.cookie)
      return await withClearedFlow(redirect)
    }
    catch (error) {
      if (error instanceof SocialSignInRefusedError)
        return failure(error.message)

      // Provider errors can echo codes or addresses; the message stays in the log.
      log.error(`[socials] ${provider} callback failed: ${(error as Error).message}`)
      return failure('Sign-in could not be completed. Please try again.')
    }
  },
})

/** Apple's first-authorization `user` field: `{"name":{"firstName","lastName"}}`. */
function appleDisplayName(value: string): string {
  if (!value || value.length > 4096)
    return ''
  try {
    const name = (JSON.parse(value) as { name?: { firstName?: unknown, lastName?: unknown } })?.name
    return [name?.firstName, name?.lastName]
      .filter((part): part is string => typeof part === 'string')
      .join(' ')
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001F\u007F]/g, '')
      .trim()
      .slice(0, 255)
  }
  catch {
    return ''
  }
}
