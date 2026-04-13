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
