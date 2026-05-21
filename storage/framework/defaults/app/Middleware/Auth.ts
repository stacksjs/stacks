import { HttpError } from '@stacksjs/error-handling'
import { Middleware } from '@stacksjs/router'

/**
 * Authentication Middleware
 *
 * Validates the bearer token from the request and ensures
 * the user is authenticated before proceeding.
 *
 * Usage:
 * route.get('/dashboard', 'DashboardAction').middleware('auth')
 * route.group({ middleware: 'auth' }, () => { ... })
 */
function extractBearerToken(request: any): string | null {
  if (typeof request.bearerToken === 'function') {
    const t = request.bearerToken()
    if (t)
      return t
  }
  const authHeader
    = (typeof request.header === 'function' && request.header('authorization'))
    || request.headers?.get?.('authorization')
    || request.headers?.get?.('Authorization')
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer '))
    return authHeader.substring(7)
  return null
}

export default new Middleware({
  name: 'Auth',
  priority: 1,

  async handle(request) {
    const { Auth } = await import('@stacksjs/auth')

    const bearerToken = extractBearerToken(request)

    if (!bearerToken)
      throw new HttpError(401, 'Unauthorized. No token provided.')

    const isValid = await Auth.validateToken(bearerToken)
    if (!isValid)
      throw new HttpError(401, 'Unauthorized. Invalid token.')

    const user = await Auth.getUserFromToken(bearerToken)
    if (user) {
      Auth.setUser(user)
      ;request._authenticatedUser = user
      // Do NOT overwrite `request.user` — `enhanceRequest` declared
      // it as an async function (`user(): Promise<UserModel | undefined>`)
      // and downstream action code reaches for `await request.user()`.
      // Replacing the function with a User object made every caller
      // throw "user is not a function" post-auth. Read from
      // `_authenticatedUser` via `request.user()` instead — the helper
      // prefers the stamped value before falling back to a token
      // lookup. See stacksjs/stacks#1860 M-9.
    }
  },
})
