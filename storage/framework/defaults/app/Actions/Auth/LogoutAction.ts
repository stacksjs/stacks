import { Action } from '@stacksjs/actions'
import { Auth, clearAuthCookie, requestToken } from '@stacksjs/auth'
import { getCurrentRequest, response } from '@stacksjs/router'

export default new Action({
  name: 'LogoutAction',
  description: 'Logout from the application',
  method: 'POST',
  async handle() {
    const request = getCurrentRequest()
    const usesDatabaseSession = !requestToken(request) && !!request?.cookie?.('session_id')
    await Auth.logout()

    // Clearing is separate from revoking, and both are needed. Revoking alone
    // leaves the browser sending a dead cookie on every request; clearing alone
    // leaves a copied cookie valid for the token's whole lifetime, which would
    // make "log out on a shared computer" mean only "hide the key".
    const result = response.json(
      { message: 'Successfully logged out' },
      { headers: { 'Set-Cookie': clearAuthCookie() } },
    )
    if (usesDatabaseSession)
      result.headers.append('Set-Cookie', clearAuthCookie({ name: 'session_id' }))
    return result
  },
})
