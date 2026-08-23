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
export { assertRouteMiddlewareResolvable,
  configureViewDirectories, clearCsrfModuleCache, clearMiddlewareCache, createStacksRouter, disableViewRouting, findUnresolvableRouteMiddleware, installMiddlewareHotReload, resetBootHooks, route, runBootHooks, serve, serverResponse, url, warnOnMultipleRouterInstances } from './stacks-router'
export type { BootHook } from './stacks-router'

// Export request context helpers
export { cacheRequestQuery, clearCurrentRequest, getCurrentRequest, getTraceId, request, runWithRequest, setCurrentRequest, withTraceId } from './request-context'

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
export { listNamedRoutes, listRegisteredRoutes, routeParams } from './stacks-router'
export type { UrlParams } from './stacks-router'

// Registering an action by import rather than by name: the seam that lets a
// route hand over the action object it already has, instead of a string that
// only a runtime `import()` can make sense of. `listRegisteredRoutes()` reports
// it, which is how the OpenAPI generator reads such a route's schema without a
// file path to import.
export { isRouterAction, wrapAction } from './stacks-router'
export type { ChainableRoute, RouterAction, StacksHandler, StacksRouterInstance } from './stacks-router'

/*
 * Typed routes, bound to this application's router.
 *
 * The builder, the route-map contract and the client itself all come from
 * `@stacksjs/bun-router` (re-exported above by the star export at the top of
 * this file) - `createTypedClient`, `TypedRouter`, `RoutesOf`, `defineEndpoint`
 * and the rest are available from here without being named again. Only the
 * binding to the `route` singleton is specific to Stacks, and that is what
 * `./typed-router` adds; it deliberately shadows the star-exported name.
 */
export { createTypedRouter } from './typed-router'

// Route-model binding (stacksjs/stacks#2231): what lets `can:view,site`
// reach `SitePolicy.view(user, site)` instead of handing the policy layer a
// raw path string it can never match a policy against.
export {
  clearRouteModelBindings,
  defineRouteModelBinding,
  resolveRouteModel,
  routeModelBindings,
  setRouteModelFallback,
  type RouteModelContext,
  type RouteModelResolution,
  type RouteModelResolver,
} from './route-model-binding'

// Export JSON-vs-HTML negotiation predicate so userland can short-circuit
// the same decision the framework makes in formatResult / error-handler.
export { isApiRequest, JSON_CONTENT_TYPE } from './api-shape'

// Export action-level rate limiting helpers
export { rateLimit, rateLimitStatus, clearRateLimit } from './rate-limit'

// Export path-param sanitization helper (stacksjs/stacks#1870 R-12).
// Defense-in-depth for actions that interpolate route params into
// filesystem paths; the helper enforces no-traversal / no-absolute /
// no-null-byte / length ceiling at a single chokepoint.
export { PathParamError, safePathParam, sanitizePathParam } from './path-sanitize'
export type { PathParamRejection, SanitizePathParamOptions } from './path-sanitize'

// Shared dependency probes used by the public load-balancer endpoint and
// authenticated operational dashboards.
export { checkApplicationHealth, runHealthProbes } from './health'
export type { ApplicationHealthCheck, ApplicationHealthResult, HealthProbe, HealthProbeOptions } from './health'

// Export the streaming-response helper for SSE / NDJSON / chunked
// binary returns (stacksjs/stacks#1870 R-4). Actions can return
// `stream(asyncGen, { type: 'sse' })` and the router pipes it back
// with the right Content-Type + no-cache headers.
export { stream } from './stacks-router'
export type { StreamOptions } from './stacks-router'

// Signed-URL helpers — HMAC over the URL + optional expiry so single-
// use links (email verify, password reset, unsubscribe) can be handed
// out without long-lived bearer tokens. Pair `signedUrl(...)` with the
// `signed` middleware (or call `verifySignedUrl(req.url)` directly).
// See stacksjs/stacks#1870 R-7.
export { signedUrl, signUrl, verifySignedUrl, verifySignedUrlMiddleware } from './signed-url'
export type { SignedUrlOptions, SignedUrlVerifyResult } from './signed-url'

// Encryption-at-rest wrapper for any bun-router SessionStore
// (stacksjs/stacks#1878 Se-4). Opt-in: wrap your existing store
// instance so session payloads are AES-GCM encrypted via APP_KEY
// before being persisted.
export { EncryptedSessionStore } from './encrypted-session-store'
export type { EncryptedSessionStoreOptions } from './encrypted-session-store'

// Session driver factory (stacksjs/stacks#1889, F-2 from #1874).
// Builds a SessionStore from the Stacks config — picks the right
// driver from `config.session.driver`, optionally wraps with
// EncryptedSessionStore. Re-exports all four bun-router store
// classes so callers can assemble custom stacks manually too.
export {
  createSessionStore,
  createStacksSessionStore,
  DatabaseSessionStore,
  FileSessionStore,
  MemorySessionStore,
  RedisSessionStore,
} from './session-factory'
export type {
  RedisClient,
  SessionConfig,
  SessionData,
  SessionStore,
  StacksSessionConfig,
} from './session-factory'

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
