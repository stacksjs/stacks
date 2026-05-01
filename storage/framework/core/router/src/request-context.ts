/**
 * Request Context
 *
 * Provides a way to access the current request from anywhere in the application.
 * Uses AsyncLocalStorage for proper request isolation in async contexts.
 */

import type { EnhancedRequest } from '@stacksjs/bun-router'
import process from 'node:process'
import { AsyncLocalStorage } from 'node:async_hooks'
import { log } from '@stacksjs/logging'

// AsyncLocalStorage for request context
const requestStorage = new AsyncLocalStorage<EnhancedRequest>()

/**
 * Trace-ID propagation. A separate ALS slot from the request itself
 * because:
 *
 *   1. Background work (queued jobs, cron triggers) wants a trace ID
 *      but doesn't have a `Request` to attach one to.
 *   2. Tests can set a trace ID without instantiating a fake request.
 *   3. The trace ID outlives the request: log lines emitted *after* the
 *      response has been sent (e.g. fire-and-forget analytics calls)
 *      should still carry the same id.
 */
const traceStorage = new AsyncLocalStorage<string>()

/**
 * Read the active trace id, or `undefined` outside any traced scope.
 *
 * Falls back to the request's `_requestId` if no explicit trace was
 * set so the helper is always useful from an HTTP handler — the router
 * sets `_requestId` per request, and that value is the implicit trace
 * for downstream calls until something more specific is configured.
 */
export function getTraceId(): string | undefined {
  const explicit = traceStorage.getStore()
  if (explicit) return explicit
  const req = requestStorage.getStore() as (EnhancedRequest & { _requestId?: string }) | undefined
  return req?._requestId
}

/**
 * Run `fn` under a fresh trace scope. Used by queue workers and cron
 * triggers to associate background work with the originating request
 * (or a synthetic id when there's no parent).
 *
 * @example
 * ```ts
 * await withTraceId(genId(), async () => {
 *   await job.handle()
 * })
 * ```
 */
export function withTraceId<T>(id: string, fn: () => T): T {
  return traceStorage.run(id, fn)
}

/**
 * Per-request query cache. The store is the same `EnhancedRequest`
 * object the rest of the framework already shares, so the cache is
 * naturally bound to a single request lifetime — no manual cleanup,
 * no leaking across requests.
 *
 * Use `cacheRequestQuery` from inside any code that has a request in
 * scope (i.e. anywhere downstream of `runWithRequest`) to dedupe
 * identical queries within the same request. The first caller fires
 * the underlying call; concurrent and subsequent callers await the
 * same Promise.
 *
 * Outside of a request — e.g. CLI scripts, queued jobs — `fetcher`
 * runs as-is, with no caching.
 */
const REQUEST_QUERY_CACHE_KEY = Symbol.for('stacks.requestQueryCache')

interface RequestQueryCache {
  map: Map<string, Promise<unknown>>
}

function getRequestCache(): RequestQueryCache | undefined {
  const req = requestStorage.getStore() as EnhancedRequest & { [k: symbol]: unknown } | undefined
  if (!req) return undefined
  let cache = req[REQUEST_QUERY_CACHE_KEY] as RequestQueryCache | undefined
  if (!cache) {
    cache = { map: new Map<string, Promise<unknown>>() }
    ;(req as Record<symbol, unknown>)[REQUEST_QUERY_CACHE_KEY] = cache
  }
  return cache
}

/**
 * Run `fetcher()` once per `key` per request. Subsequent callers within
 * the same request lifecycle await the cached Promise.
 *
 * @example
 * ```ts
 * const user = await cacheRequestQuery(`User.find:${id}`, () => User.find(id))
 * ```
 */
export async function cacheRequestQuery<T>(key: string, fetcher: () => T | Promise<T>): Promise<T> {
  const cache = getRequestCache()
  if (!cache) return fetcher() as Promise<T>
  const existing = cache.map.get(key)
  if (existing) return existing as Promise<T>
  const promise = Promise.resolve().then(() => fetcher()) as Promise<T>
  cache.map.set(key, promise)
  // Drop failures so a transient DB error doesn't poison the slot for
  // the rest of the request.
  promise.catch(() => cache.map.delete(key))
  return promise
}

/**
 * Set the current request context
 * Called by middleware/router when handling a request
 */
export function setCurrentRequest(req: EnhancedRequest): void {
  log.debug(`[request] ${req.method} ${new URL(req.url).pathname}`)
  // Use enterWith to set the request context for the current async scope.
  // This is useful for testing and middleware that operate outside of runWithRequest.
  requestStorage.enterWith(req)
}

/**
 * Run a function with a request context
 * All code executed within the callback will have access to the request
 */
export function runWithRequest<T>(req: EnhancedRequest, fn: () => T): T {
  return requestStorage.run(req, fn)
}

/**
 * Get the current request from context
 */
export function getCurrentRequest(): EnhancedRequest | undefined {
  return requestStorage.getStore()
}

/**
 * Request proxy that provides access to the current request
 * Similar to Laravel's request() helper
 *
 * Methods:
 * - bearerToken() - Get the bearer token from Authorization header
 * - user() - Get the authenticated user (async)
 * - userToken() - Get the current access token (async)
 * - tokenCan(ability) - Check if token has an ability (async)
 * - tokenCant(ability) - Check if token doesn't have an ability (async)
 */
export const request = new Proxy({} as EnhancedRequest, {
  get(_target, prop: string): any {
    const currentRequest = getCurrentRequest()

    if (!currentRequest) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[RequestContext] Accessing request.${String(prop)} outside of request context`)
      }
      // Return safe defaults when no request context
      if (prop === 'bearerToken') {
        return (): any => null
      }
      if (prop === 'user' || prop === 'userToken') {
        return async (): Promise<any> => undefined
      }
      if (prop === 'tokenCan' || prop === 'tokenCant') {
        return async () => false
      }
      if (prop === 'headers') {
        return new Headers()
      }
      if (prop === 'url') {
        return ''
      }
      if (prop === 'method') {
        return 'GET'
      }
      return undefined
    }

    const value = (currentRequest as any)[prop]
    if (typeof value === 'function') {
      return value.bind(currentRequest)
    }
    return value
  },
})
