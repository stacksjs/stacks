import { Action } from '@stacksjs/actions'
import { Auth, authCookie, resolveSocialSignIn, SocialSignInRefusedError } from '@stacksjs/auth'
import { log } from '@stacksjs/logging'
import { response } from '@stacksjs/router'
import { isSocialProviderConfigured, socialHandoffFailureRedirect, socialHandoffRedirect, socialProvider } from '@stacksjs/socials'

/**
 * `GET|POST /auth/{provider}/callback` — complete a social sign-in
 * (stacksjs/stacks#2276).
 *
 * The provider redirects back here with a `code`. The driver exchanges it for
 * the provider's user, `resolveSocialSignIn` decides which local user that is
 * (find-or-create, with the unverified-email takeover guard), and the session
 * is handed to the browser twice over: the auth cookie for server-rendered
 * pages, and the fragment handoff `useAuth().completeSocialLogin()` reads for
 * the SPA side. POST as well as GET because Apple mandates
 * `response_mode=form_post` whenever scopes are requested.
 *
 * A refused sign-in redirects to /login with a `social_error` the page can
 * render; it is a policy decision, not an exception. Provider/exchange
 * failures land there too, with the detail in the log rather than the URL.
 */
export default new Action({
  name: 'SocialCallbackAction',
  description: 'Completes a social provider OAuth flow and signs the browser in.',
  method: 'GET',

  async handle(request: RequestInstance) {
    const provider = String(request.getParam('provider') ?? '').toLowerCase()

    if (!isSocialProviderConfigured(provider))
      return response.notFound(`Social provider "${provider}" is not configured.`)

    const driver = socialProvider(provider)
    if (!driver)
      return response.notFound(`Social provider "${provider}" is not configured.`)

    const code = String(request.get('code') ?? '')
    if (!code)
      return socialHandoffFailureRedirect(`${provider} did not return an authorization code.`)

    try {
      const accessToken = await driver.getAccessToken(code)
      const identity = await driver.getUserByToken(accessToken)

      const { userId } = await resolveSocialSignIn(provider, identity)

      const session = await Auth.loginUsingId(userId)
      if (!session?.token)
        return socialHandoffFailureRedirect('Sign-in could not be completed. Please try again.')

      const redirect = socialHandoffRedirect({
        token: session.token,
        ...(session.refreshToken && { refreshToken: session.refreshToken }),
        ...(session.expiresIn !== undefined && { expiresIn: session.expiresIn }),
        user: {
          id: userId,
          email: identity.email ?? null,
          name: identity.name ?? identity.nickname ?? null,
        },
      })

      // The cookie signs server-rendered pages in; the fragment pack the SPA.
      redirect.headers.append('Set-Cookie', authCookie(session.token))
      return redirect
    }
    catch (error) {
      if (error instanceof SocialSignInRefusedError)
        return socialHandoffFailureRedirect(error.message)

      log.error(`[socials] ${provider} callback failed: ${(error as Error).message}`)
      return socialHandoffFailureRedirect('Sign-in could not be completed. Please try again.')
    }
  },
})
