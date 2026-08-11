import { Action } from '@stacksjs/actions'
import { Auth, clearAuthCookie } from '@stacksjs/auth'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'LogoutAction',
  description: 'Logout from the application',
  method: 'POST',
  async handle() {
    // `Auth.logout()` resolves the token from the Authorization header or the
    // auth cookie, so this revokes the session either way.
    await Auth.logout()

    // Clearing is separate from revoking, and both are needed. Revoking alone
    // leaves the browser sending a dead cookie on every request; clearing alone
    // leaves a copied cookie valid for the token's whole lifetime, which would
    // make "log out on a shared computer" mean only "hide the key".
    return response.json(
      { message: 'Successfully logged out' },
      { headers: { 'Set-Cookie': clearAuthCookie() } },
    )
  },
})
