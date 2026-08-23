import { Action } from '@stacksjs/actions'
import { sendMagicLink } from '@stacksjs/auth'
import { config } from '@stacksjs/config'
import { response } from '@stacksjs/router'
import { schema } from '@stacksjs/validation'

export default new Action({
  name: 'MagicLinkSendAction',
  description: 'Email a passwordless sign-in link',
  method: 'POST',

  validations: {
    email: {
      rule: schema.string().email().required(),
      message: 'Email must be a valid email address.',
    },
  },

  async handle(request: RequestInstance) {
    if (!config.auth.magicLink?.enabled)
      return response.notFound('Magic-link sign-in is not enabled')

    const email = request.get('email')
    const redirectTo = request.get('redirect_to') as string | undefined

    // Fire-and-return uniform: sendMagicLink is a silent no-op for unknown
    // emails and self-rate-limits per address, so the response never says
    // whether the account exists.
    await sendMagicLink(String(email), { redirectTo })

    return response.json({
      message: 'If an account exists for that address, a sign-in link is on its way.',
    }, { status: 202 })
  },
})
