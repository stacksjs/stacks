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
export default new Middleware({
  name: 'Auth',
  priority: 1,

  async handle(request) {
    const { Auth } = await import('@stacksjs/auth')

    const bearerToken = request.bearerToken()

    if (!bearerToken) {
      throw new HttpError(401, 'Unauthorized. No token provided.')
    }

    const isValid = await Auth.validateToken(bearerToken)
    if (!isValid) {
      throw new HttpError(401, 'Unauthorized. Invalid token.')
    }
  },
})
