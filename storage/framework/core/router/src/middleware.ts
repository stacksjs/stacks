import type { EnhancedRequest } from '@stacksjs/bun-router'

/**
 * Middleware class for defining route middleware
 *
 * Provides a simple, structured way to define middleware handlers
 * that can be attached to routes and route groups.
 *
 * The request object is an EnhancedRequest with helper methods like
 * `bearerToken()`, `get()`, `input()`, `has()`, etc.
 *
 * @example
 * ```ts
 * import { Middleware } from '@stacksjs/router'
 *
 * export default new Middleware({
 *   name: 'Auth',
 *   priority: 1,
 *   async handle(request) {
 *     const token = request.bearerToken()
 *     if (!token) throw new HttpError(401, 'Unauthorized')
 *   },
 * })
 * ```
 */

export type Request = EnhancedRequest

export interface MiddlewareConfig {
  /** Middleware name — used for identification and debugging */
  name: string
  /** Execution priority — lower numbers run first (default: 10) */
  priority?: number
  /** The middleware handler — throw HttpError or Response to short-circuit */
  handle: (request: EnhancedRequest) => void | Promise<void>
}

export class Middleware {
  readonly name: string
  readonly priority: number
  readonly handle: (request: EnhancedRequest) => void | Promise<void>

  constructor(config: MiddlewareConfig) {
    this.name = config.name
    this.priority = config.priority ?? 10
    this.handle = config.handle
  }

  /**
   * Adapt this Middleware to the bun-router (req, next) → Response shape.
   *
   * The Middleware class contract is "return void to continue, throw a
   * Response/HttpError to short-circuit". Bun-router's middleware contract
   * is "call next() and return its Response". Pushing `handle.bind(this)`
   * straight onto `globalMiddleware` drops the second contract on the
   * floor — `handle` ignores `next` and returns `undefined`, which
   * `buildMiddlewareChain` interprets as a final response, so it falls
   * back to `new Response(null, { status: 200 })` and the actual route
   * handler downstream never runs. Visible symptom: every route returns
   * `200 OK` with `Content-Length: 0`.
   *
   * Use this adapter whenever attaching a `Middleware` instance via
   * `route.use(...)` or `route.middleware(...)` so the void/throw contract
   * is honoured.
   */
  toRouterHandler(): (req: EnhancedRequest, next: () => Promise<Response>) => Promise<Response> {
    const handle = this.handle.bind(this)
    return async (req, next) => {
      try {
        await handle(req)
      }
      catch (thrown) {
        if (thrown instanceof Response) return thrown
        throw thrown
      }
      return next()
    }
  }
}
