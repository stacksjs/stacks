import type { Request } from '@stacksjs/router'
import { Auth } from '@stacksjs/auth'
import { HttpError } from '@stacksjs/error-handling'
import { Middleware } from '@stacksjs/router'

/**
 * Bearer Token Authentication Middleware
 *
 * This middleware validates bearer tokens in the Authorization header.
 * It uses the Auth class to verify tokens and retrieve the authenticated user.
 *
 * Usage:
 * - Add 'auth' middleware to routes that require authentication
 * - The authenticated user will be available via request.user()
 */
export default new Middleware({
  name: 'auth',
  priority: 1,

  async handle(request: Request) {
    const bearerToken = request.bearerToken()

    if (!bearerToken) {
      throw new HttpError(401, 'No authentication token provided.')
    }

    // Validate the token
    const isValid = await Auth.validateToken(bearerToken)

    if (!isValid) {
      throw new HttpError(401, 'Invalid or expired authentication token.')
    }

    // Get the authenticated user and attach to request
    const user = await Auth.getUserFromToken(bearerToken)

    if (!user) {
      throw new HttpError(401, 'Unable to authenticate user.')
    }

    // Store the authenticated user on the request for later use
    ;(request as any)._authenticatedUser = user
  },
})
