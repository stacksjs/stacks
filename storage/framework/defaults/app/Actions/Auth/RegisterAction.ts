import { Action } from '@stacksjs/actions/runtime'
import { Auth, authCookieForBrowserSession, DISPLAY_NAME_MAX_LENGTH, DISPLAY_NAME_MIN_LENGTH, greetingName, normalizeAuthEmail, register, resolveBrowserSessionPolicy } from '@stacksjs/auth'
import { config } from '@stacksjs/config'
import { dispatch } from '@stacksjs/events'
import { rateLimit, response } from '@stacksjs/router'
import { schema } from '@stacksjs/validation/runtime'
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, PASSWORD_POLICY_MESSAGE } from '../../password-policy'

export default new Action({
  name: 'RegisterAction',
  description: 'Register a new user',
  method: 'POST',

  validations: {
    email: {
      rule: schema.string().email().required(),
      message: 'Email must be a valid email address.',
    },
    password: {
      rule: schema.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH).required(),
      message: PASSWORD_POLICY_MESSAGE,
    },
    name: {
      // Length only. What a name may contain (no links, markup or control
      // characters) is `register()`'s rule, so it holds for every caller.
      rule: schema.string().min(DISPLAY_NAME_MIN_LENGTH).max(DISPLAY_NAME_MAX_LENGTH).required(),
      message: `Name must be between ${DISPLAY_NAME_MIN_LENGTH} and ${DISPLAY_NAME_MAX_LENGTH} characters.`,
    },
  },

  async handle(request: RequestInstance) {
    const email = request.get('email')
    const password = request.get('password')
    const name = request.get('name')
    const policy = resolveBrowserSessionPolicy(request.get('remember'))

    // Hourly budgets, before the bcrypt hash and the insert. The route's
    // 3-a-minute limit stops a burst and still lets one address create four
    // thousand accounts a day; these are what make bulk sign-up slow. The
    // email budget also caps how often one mailbox can be sent a welcome by
    // somebody guessing at it.
    const limits = config.auth?.registration?.rateLimit
    const perIp = limits?.perIp ?? 20
    const perEmail = limits?.perEmail ?? 5
    if (perIp !== false)
      await rateLimit('register-ip', perIp).per('hour')
    if (perEmail !== false && typeof email === 'string')
      await rateLimit('register-email', perEmail, { identity: `email:${normalizeAuthEmail(email)}` }).per('hour')

    const referralCode = request.get('referralCode')
    const result = await register(
      { email, password, name, referralCode: typeof referralCode === 'string' ? referralCode : undefined },
      { expiresInMinutes: policy.expiresInMinutes, withRefreshToken: policy.withRefreshToken },
    )

    if (result) {
      const user = await Auth.getUserFromToken(result.token)

      // Fire `user:registered` so app/Events.ts listeners (welcome email,
      // CRM sync, internal slack ping, etc.) actually run. Fire-and-forget
      // — listener errors are caught by the wildcard handler so a flaky
      // welcome email doesn't fail registration. The `to` alias matches
      // the contract SendWelcomeEmail expects.
      // `to` is what SendWelcomeEmail addresses the mail to, so it has to be
      // a string; the registering address is the honest fallback if the
      // freshly-created user could not be read back.
      //
      // `name` is the first name a mail may print, or nothing: the address
      // has not been confirmed, so whatever the listener sends goes to
      // someone who may never have asked for it. Listeners that need the
      // stored name read the user by `id`.
      dispatch('user:registered', {
        id: user?.id,
        email: user?.email ?? email,
        name: greetingName(user?.name),
        to: user?.email ?? email,
      })

      // Same OAuth2-compatible payload LoginAction returns, so a client can
      // code against one shape. Registering used to hand back only `token`,
      // which left brand-new accounts with no refresh token to exchange — they
      // were signed out an hour into their first session while every other
      // user refreshed normally (stacksjs/stacks#2212). The legacy `token`
      // alias stays for backward compatibility.
      // Registering signs the account in, so it is a session-issuing path like
      // the other three and carries the cookie for the same reason: the very
      // next thing a server-rendered app does is redirect to an authenticated
      // page (#2306).
      return response.json({
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
      }, { headers: { 'Set-Cookie': authCookieForBrowserSession(result.token, result.expiresIn) } })
    }

    return response.error('Registration failed')
  },
})
