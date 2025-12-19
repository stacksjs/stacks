import type { Request } from '@stacksjs/router'

import { HttpError } from '@stacksjs/error-handling'
import { Middleware } from '@stacksjs/router'

/**
 * Token Abilities Middleware
 *
 * This middleware checks if the current token has the required abilities/scopes.
 * Must be used after the 'auth' middleware.
 *
 * Usage:
 * - Add 'abilities:read,write' middleware to routes that require specific abilities
 * - The abilities are passed as a comma-separated string after the colon
 *
 * Example:
 * route.get('/admin', 'AdminAction').middleware('auth').middleware('abilities:admin')
 * route.post('/posts', 'CreatePostAction').middleware('auth').middleware('abilities:posts:create')
 */
export default new Middleware({
  name: 'abilities',
  priority: 2, // Run after auth middleware

  async handle(request: Request) {
    // Get the required abilities from middleware parameters
    // This would be passed like 'abilities:read,write'
    const requiredAbilities = (request as any)._middlewareParams?.abilities?.split(',') || []

    if (requiredAbilities.length === 0) {
      // No abilities required, pass through
      return
    }

    // Get the current access token
    const token = (request as any)._currentAccessToken

    if (!token) {
      throw new HttpError(401, 'Unauthenticated.')
    }

    const tokenAbilities: string[] = token.abilities || []

    // Wildcard grants all permissions
    if (tokenAbilities.includes('*')) {
      return
    }

    // Check if token has ALL required abilities
    for (const ability of requiredAbilities) {
      if (!tokenAbilities.includes(ability.trim())) {
        throw new HttpError(403, `Missing required ability: ${ability.trim()}`)
      }
    }
  },
})
