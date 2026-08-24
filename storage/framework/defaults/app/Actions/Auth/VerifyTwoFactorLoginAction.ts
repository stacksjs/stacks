import { Action } from '@stacksjs/actions'
import { Auth, authCookie, consumeTwoFactorChallenge, verifyTwoFactorLoginCode } from '@stacksjs/auth'
import { response } from '@stacksjs/router'
import { schema } from '@stacksjs/validation'

export default new Action({
  name: 'VerifyTwoFactorLoginAction',
  description: 'Exchange a LoginAction 2FA challenge + TOTP code for a real token pack',
  method: 'POST',

  validations: {
    challenge_token: {
      rule: schema.string().min(1).required(),
      message: 'A challenge token is required.',
    },
    code: {
      rule: schema.string().min(6).max(6).required(),
      message: 'Code must be a 6-digit TOTP code.',
    },
  },

  async handle(request: RequestInstance) {
    const challengeToken = request.get('challenge_token')
    const code = request.get('code')

    // Single-use: a second attempt with the same challenge token
    // (whether the code was right or wrong) must start over from
    // LoginAction, not retry — mirrors the WebAuthn challenge
    // delete-on-read semantics in passkey.ts (stacksjs/stacks#1866).
    const userId = await consumeTwoFactorChallenge(challengeToken)
    if (!userId)
      return response.unauthorized('This login attempt has expired — please sign in again.')

    const valid = await verifyTwoFactorLoginCode(userId, code)
    if (!valid)
      return response.unauthorized('Invalid code — please sign in again.')

    const result = await Auth.loginUsingId(userId)
    if (!result)
      return response.unauthorized('Invalid code — please sign in again.')

    const user = result.user

    // This is where a 2FA account's session actually begins — LoginAction
    // deliberately mints nothing for these users until the code is verified —
    // so the cookie belongs here too. Setting it only on LoginAction would
    // have left every 2FA account exactly where it started (#2306).
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
    }, { headers: { 'Set-Cookie': authCookie(result.token) } })
  },
})
