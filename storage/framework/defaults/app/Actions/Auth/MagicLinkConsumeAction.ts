import { Action } from '@stacksjs/actions'
import { Auth, authCookie, consumeMagicLink } from '@stacksjs/auth'
import { config } from '@stacksjs/config'
import { response } from '@stacksjs/router'
import { schema } from '@stacksjs/validation'

export default new Action({
  name: 'MagicLinkConsumeAction',
  description: 'Consume a magic link and sign the user in',
  method: 'POST',

  validations: {
    token: {
      rule: schema.string().min(16).max(255).required(),
      message: 'Token is required.',
    },
  },

  async handle(request: RequestInstance) {
    if (!config.auth.magicLink?.enabled)
      return response.notFound('Magic-link sign-in is not enabled')

    const consumed = await consumeMagicLink(String(request.get('token')))
    if (!consumed.ok) {
      const messages: Record<string, string> = {
        invalid: 'That sign-in link is not valid.',
        expired: 'That sign-in link has expired. Request a new one.',
        used: 'That sign-in link was already used. Request a new one.',
        'no-user': 'That sign-in link is not valid.',
      }
      return response.unauthorized(messages[consumed.reason] ?? 'That sign-in link is not valid.')
    }

    // The same token pack + httpOnly cookie a password login issues, so
    // stxPageAuthMiddleware-gated pages treat passwordless users identically.
    const result = await Auth.loginUsingId(consumed.userId)
    if (!result)
      return response.unauthorized('That sign-in link is not valid.')

    return response.json({
      access_token: result.token,
      refresh_token: result.refreshToken,
      token_type: 'Bearer',
      expires_in: result.expiresIn,
      redirect_to: consumed.redirectTo,
      user: {
        id: result.user?.id,
        email: result.user?.email,
        name: result.user?.name,
      },
    }, { headers: { 'Set-Cookie': authCookie(result.token) } })
  },
})
