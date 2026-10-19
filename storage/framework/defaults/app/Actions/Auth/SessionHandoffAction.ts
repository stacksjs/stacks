import { Action } from '@stacksjs/actions/runtime'
import { Auth, authCookieForBrowserSession, clearSessionHandoffCookie, readSessionHandoffCookie, redeemSessionHandoff, resolveBrowserSessionPolicy } from '@stacksjs/auth'

/**
 * `POST /auth/handoff` — trade a one-use sign-in code for a session.
 *
 * SocialCallbackAction ends by redirecting with a 60-second code in the URL
 * fragment and a matching HttpOnly cookie. `useAuth().completeSocialLogin()`
 * posts the code here. The code redeems once, and only with the cookie that
 * was set beside it (or, for a native app whose sign-in sheet has its own
 * cookie jar, the `verifier` behind the challenge it started with). A code
 * copied out of history, a log or another browser answers 401.
 *
 * The answer is LoginAction's: an OAuth2-shaped token pack plus the auth
 * cookie for server-rendered pages.
 *
 * CSRF is skipped on the route because the binding cookie is the proof a
 * CSRF token would add: a cross-site page can neither read the code nor make
 * the browser present someone else's binding cookie.
 */
export default new Action({
  name: 'SessionHandoffAction',
  description: 'Redeems a one-use sign-in handoff code for a session.',
  method: 'POST',

  async handle(request: RequestInstance) {
    const code = String(request.get('code') ?? '')
    const verifier = request.get('verifier')
    const secret = typeof verifier === 'string' && verifier
      ? verifier
      : readSessionHandoffCookie(request.headers.get('cookie'), code)

    const headers = new Headers({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' })
    if (/^[a-f0-9]{64}$/.test(code))
      headers.append('Set-Cookie', await clearSessionHandoffCookie(code))

    const handoff = await redeemSessionHandoff(code, secret)
    if (!handoff)
      return Response.json({ error: 'This sign-in expired or was started in another browser. Please try again.' }, { status: 401, headers })

    // The baseline (not remembered) browser session, as the other sign-in paths issue.
    const policy = resolveBrowserSessionPolicy(false)
    const result = await Auth.loginUsingId(handoff.userId, {
      expiresInMinutes: policy.expiresInMinutes,
      withRefreshToken: policy.withRefreshToken,
    })
    if (!result?.token)
      return Response.json({ error: 'Sign-in could not be completed. Please try again.' }, { status: 401, headers })

    headers.append('Set-Cookie', authCookieForBrowserSession(result.token, result.expiresIn))
    const user = result.user
    return Response.json({
      access_token: result.token,
      refresh_token: result.refreshToken,
      token_type: 'Bearer',
      expires_in: result.expiresIn,
      token: result.token,
      user: {
        id: user?.id,
        email: user?.email,
        name: user?.name,
      },
    }, { headers })
  },
})
