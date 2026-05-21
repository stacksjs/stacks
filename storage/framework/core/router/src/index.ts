/**
 * @stacksjs/router - Stacks Router
 *
 * A thin wrapper around bun-router that adds Stacks-specific
 * action/controller resolution for string-based route handlers.
 *
 * All routing functionality comes directly from bun-router.
 */

// Side-import the EnhancedRequest module augmentation so every consumer
// of @stacksjs/router gets the typed Stacks markers (_corsConfig,
// _requestId, _authenticatedUser, …) and Laravel-style macros (input,
// all, has, file, user, …) without `as any` casts. See
// `./request-augmentation.ts` and stacksjs/stacks#1863 T-3.
import './request-augmentation'

// Re-export everything from bun-router (includes response factory)
export * from '@stacksjs/bun-router'

// Re-export the augmentation types so userland can refer to the marker
// surface explicitly when needed.
export type { StacksRequestExtensions, StacksRequestMacros, StacksRequestMarkers } from './request-augmentation'

// Export Stacks-specific action resolver and URL helper
export { clearMiddlewareCache, createStacksRouter, installMiddlewareHotReload, route, serve, serverResponse, url } from './stacks-router'

// Export request context helpers
export { cacheRequestQuery, getCurrentRequest, getTraceId, request, runWithRequest, setCurrentRequest, withTraceId } from './request-context'

// Export Middleware class for defining route middleware
export { Middleware } from './middleware'
export type { MiddlewareConfig, Request } from './middleware'

// Export route loader
export { loadRoutes } from './route-loader'

// Export route registry types — owned here rather than in app/Routes.ts
// so the path doesn't depend on a 5-level relative reach across the
// framework defaults tree (stacksjs/stacks#1863, T-10).
export type { RouteDefinition, RouteRegistry } from './route-types'

// Export error handler utilities
export {
  clearTrackedQueries,
  createErrorResponse,
  createMiddlewareErrorResponse,
  createNotFoundResponse,
  createValidationErrorResponse,
  getQueryShapeCounts,
  trackQuery,
} from './error-handler'

// Export route introspection helpers
export { listRegisteredRoutes, routeParams } from './stacks-router'

// Export JSON-vs-HTML negotiation predicate so userland can short-circuit
// the same decision the framework makes in formatResult / error-handler.
export { isApiRequest, JSON_CONTENT_TYPE } from './api-shape'

// Export action-level rate limiting helpers
export { rateLimit, rateLimitStatus, clearRateLimit } from './rate-limit'

// DI: register the router's query tracker with the database package on
// import so the cycle `database → router → database` doesn't manifest
// statically. Lazy-imported via Promise so the database package stays
// optional in environments that don't load it (browser builds, etc.).
import('@stacksjs/database')
  .then(({ setQueryTracker }) => {
    if (typeof setQueryTracker === 'function') {
      // eslint-disable-next-line ts/no-require-imports
      const { trackQuery } = require('./error-handler') as { trackQuery: (q: string, t?: number, c?: string) => void }
      setQueryTracker(trackQuery)
    }
  })
  .catch(() => { /* database package not loaded — fine */ })
