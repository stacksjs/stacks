import type { Request } from '@stacksjs/router'

import { AuthorizationException, authorize } from '@stacksjs/auth'
import { HttpError } from '@stacksjs/error-handling'
import { Middleware } from '@stacksjs/router'

/**
 * Authorization Gate Middleware
 *
 * This middleware checks if the current user is authorized to perform an action
 * using the Gate system. Must be used after the 'auth' middleware.
 *
 * Usage:
 * - Add 'can:ability' middleware to routes that require specific authorization
 * - Add 'can:ability,modelParam' to authorize against a route model
 *
 * Examples:
 * route.get('/settings', 'SettingsAction').middleware('auth').middleware('can:edit-settings')
 * route.put('/posts/:post', 'UpdatePostAction').middleware('auth').middleware('can:update,post')
 * route.delete('/posts/:post', 'DeletePostAction').middleware('auth').middleware('can:delete,post')
 */
export default new Middleware({
  name: 'can',
  priority: 3, // Run after auth and abilities middleware

  async handle(request: Request) {
    // Get the ability and optional model parameter from middleware params
    // Format: 'can:ability' or 'can:ability,modelParam'
    const params = (request as any)._middlewareParams?.can?.split(',') || []

    if (params.length === 0) {
      // No ability specified, pass through (should this be an error?)
      return
    }

    const ability = params[0]?.trim()
    const modelParam = params[1]?.trim()

    if (!ability) {
      throw new HttpError(500, 'Authorization middleware requires an ability parameter')
    }

    // Get the authenticated user
    const user = (request as any).user || (request as any)._user || null

    // Prepare arguments for the gate check
    const args: any[] = []

    // If a model parameter is specified, get it from route params
    if (modelParam) {
      const routeParams = (request as any).params || {}
      const model = routeParams[modelParam]

      if (model) {
        args.push(model)
      }
    }

    // Perform the authorization check
    try {
      await authorize(ability, user, ...args)
    }
    catch (error) {
      if (error instanceof AuthorizationException) {
        throw new HttpError(error.status || 403, error.message)
      }
      throw error
    }
  },
})
