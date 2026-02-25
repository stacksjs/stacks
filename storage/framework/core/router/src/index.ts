/**
 * @stacksjs/router - Stacks Router
 *
 * A thin wrapper around bun-router that adds Stacks-specific
 * action/controller resolution for string-based route handlers.
 *
 * All routing functionality comes directly from bun-router.
 */

// Re-export everything from bun-router (includes response factory)
export * from '@stacksjs/bun-router'

// Export Stacks-specific action resolver and URL helper
export { createStacksRouter, route, serve, serverResponse, url } from './stacks-router'

// Export request context helpers
export { getCurrentRequest, request, runWithRequest, setCurrentRequest } from './request-context'

// Export Middleware class for defining route middleware
export { Middleware } from './middleware'
export type { MiddlewareConfig, Request } from './middleware'

// Export route loader
export { loadRoutes } from './route-loader'

// Export route registry types
export type { RouteDefinition, RouteRegistry } from '../../../../../app/Routes'

// Export error handler utilities
export {
  clearTrackedQueries,
  createErrorResponse,
  createMiddlewareErrorResponse,
  createNotFoundResponse,
  createValidationErrorResponse,
  trackQuery,
} from './error-handler'
