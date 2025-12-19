/**
 * Request Context
 *
 * Provides a way to access the current request from anywhere in the application.
 * Uses AsyncLocalStorage for proper request isolation in async contexts.
 */

import { AsyncLocalStorage } from 'node:async_hooks'

// Type for enhanced request with all our added methods
interface EnhancedRequest extends Request {
  bearerToken: () => string | null
  user: () => Promise<any>
  userToken: () => Promise<any>
  tokenCan: (ability: string) => Promise<boolean>
  tokenCant: (ability: string) => Promise<boolean>
  [key: string]: any
}

// AsyncLocalStorage for request context
const requestStorage = new AsyncLocalStorage<EnhancedRequest>()

/**
 * Set the current request context
 * Called by middleware/router when handling a request
 */
export function setCurrentRequest(req: EnhancedRequest): void {
  // Note: This only works within the async context started by runWithRequest
  const store = requestStorage.getStore()
  if (store) {
    // If we're in a context, we can't replace it - this is expected
    return
  }
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
  get(_target, prop: string) {
    const currentRequest = getCurrentRequest()

    if (!currentRequest) {
      // Return safe defaults when no request context
      if (prop === 'bearerToken') {
        return () => null
      }
      if (prop === 'user' || prop === 'userToken') {
        return async () => undefined
      }
      if (prop === 'tokenCan' || prop === 'tokenCant') {
        return async () => false
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
