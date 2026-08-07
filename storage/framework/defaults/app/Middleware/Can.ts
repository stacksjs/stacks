import { AuthorizationException, authorize } from '@stacksjs/auth'
import { HttpError } from '@stacksjs/error-handling'
import { Middleware, resolveRouteModel, setRouteModelFallback } from '@stacksjs/router'

/**
 * Convention binding: parameter `site` resolves through the `Site` model
 * (stacksjs/stacks#2231).
 *
 * Registered as the FALLBACK, not as a binding per name, so an app's own
 * `defineRouteModelBinding('site', …)` still wins — scoped lookups, soft
 * deletes and slug-instead-of-id all need to be expressible.
 *
 * Lives here rather than in `@stacksjs/router` because the router importing
 * `@stacksjs/orm` would close a dependency cycle. This file is app-land, where
 * importing the ORM is ordinary.
 *
 * Returning `undefined` means "no model of that name exists" and leaves the raw
 * string to pass through exactly as before. That is what keeps this from
 * changing the meaning of every existing `can:ability,param` route at once.
 */
setRouteModelFallback(async (value, { param }) => {
  // `site` -> `Site`, `blogPost` -> `BlogPost`. Only the first character is
  // touched: lowercasing the rest would turn `blogPost` into `Blogpost`.
  const modelName = param.charAt(0).toUpperCase() + param.slice(1)

  const orm = await import('@stacksjs/orm') as Record<string, any>
  const model = orm[modelName]

  // No model of that name — decline, so the raw string passes through exactly
  // as it did before this existed.
  if (!model || typeof model.find !== 'function')
    return undefined

  // `null` when the row is missing, which is deliberately NOT the same as
  // declining: the parameter IS bound, there is simply nothing there. `Can`
  // then authorizes with no model, which denies — the same 403 this route
  // produced before, rather than a 404 that would tell an anonymous caller
  // which ids exist.
  return await model.find(Number.isNaN(Number(value)) ? value : Number(value)) ?? null
})

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

  async handle(request) {
    // Get the ability and optional model parameter from middleware params
    // Format: 'can:ability' or 'can:ability,modelParam'
    const params = request._middlewareParams?.can?.split(',') || []

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
    const user = request.user || request._user || null

    // Prepare arguments for the gate check
    const args: any[] = []

    // If a model parameter is specified, resolve it to a MODEL before handing
    // it to the gate. Passing the raw path string — which is what happened
    // before — meant `resolveAbility()` saw a `String`, found no policy
    // registered under that name, and fell through to the default deny. A
    // declarative `can:view,site` could therefore never reach
    // `SitePolicy.view(user, site)` (#2231).
    if (modelParam) {
      const routeParams = request.params || {}
      const raw = routeParams[modelParam]

      if (raw !== undefined && raw !== null && raw !== '') {
        const resolution = await resolveRouteModel(modelParam, String(raw), request)

        if (!resolution.bound) {
          // Nobody claims this parameter. Push the raw value, exactly as
          // before — an app that authorizes on an id string keeps working.
          args.push(raw)
        }
        else if (resolution.model !== undefined) {
          args.push(resolution.model)
        }
        // Bound but absent: authorize with no model, which denies. Same 403
        // this produced before, and it does not disclose which ids exist.
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
