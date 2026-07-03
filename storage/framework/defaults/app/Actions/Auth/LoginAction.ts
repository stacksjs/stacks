import { createTwoFactorChallenge, getTwoFactorState } from '@stacksjs/auth'
import { User } from '@stacksjs/orm'

export default new Action({
  name: 'LoginAction',
  description: 'Login to the application',
  method: 'POST',

  validations: {
    email: {
      rule: schema.string().email(),
      message: 'Email must be a valid email address.',
    },
    password: {
      rule: schema.string().min(6).max(255),
      message: 'Password must be between 6 and 255 characters.',
    },
  },

  async handle(request: RequestInstance) {
    const email = request.get('email')
    const password = request.get('password')

    // Verify credentials WITHOUT minting tokens yet — if the account
    // has TOTP 2FA enabled, no token pack should exist until the code
    // is also verified (VerifyTwoFactorLoginAction mints the real
    // pack via Auth.loginUsingId, same as the non-2FA path below).
    const isValid = await Auth.attempt({ email, password })
    if (!isValid)
      return response.unauthorized('Incorrect email or password')

    const authedUser = await User.where('email', '=', email).first()
    if (!authedUser)
      return response.unauthorized('Incorrect email or password')

    const { enabled: twoFactorEnabled } = await getTwoFactorState(authedUser.id as number)
    if (twoFactorEnabled) {
      const challengeToken = await createTwoFactorChallenge(authedUser.id as number)
      return response.json({
        requires_two_factor: true,
        challenge_token: challengeToken,
      })
    }

    const result = await Auth.loginUsingId(authedUser.id as number)
    if (!result)
      return response.unauthorized('Incorrect email or password')

    const user = result.user

    // OAuth2-compatible payload. Clients should:
    //   - Send `Authorization: Bearer <access_token>` for API calls.
    //   - Cache the access token for at most `expires_in` seconds.
    //   - Exchange `refresh_token` at /auth/refresh when the access
    //     token nears expiry. The refresh token is single-use; the
    //     refresh response returns a new pair (rotation).
    // The legacy `token` field is kept for backward compatibility
    // with clients that haven't been updated yet — it shadows
    // `access_token` and will be removed in a future major.
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
    })
  },
})
