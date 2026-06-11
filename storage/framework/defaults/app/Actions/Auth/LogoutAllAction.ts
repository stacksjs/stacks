import { Action } from '@stacksjs/actions'
import { revokeAllTokens, sessionDestroyAll } from '@stacksjs/auth'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'LogoutAllAction',
  description: 'Logout from all devices',
  method: 'POST',
  async handle(request: RequestInstance) {
    const user = await request.user()

    if (!user?.id) {
      return response.unauthorized('Authentication required')
    }

    // Revoke every access + refresh token, then destroy every session
    // row for the user. Awaited un-caught (fail-loud) so a partial sweep
    // surfaces as a 500 instead of a "logged out everywhere" that left a
    // credential alive — same rationale as the password-reset sweep
    // (stacksjs/stacks#1957, #1947).
    await revokeAllTokens(Number(user.id))
    await sessionDestroyAll(Number(user.id))

    return response.json({
      message: 'Successfully logged out from all devices',
    })
  },
})
