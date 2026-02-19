/**
 * Middleware class for defining route middleware
 *
 * Provides a simple, structured way to define middleware handlers
 * that can be attached to routes and route groups.
 *
 * @example
 * ```ts
 * import { Middleware } from '@stacksjs/router'
 *
 * export default new Middleware({
 *   name: 'Auth',
 *   priority: 1,
 *   async handle(request: Request) {
 *     const token = request.bearerToken()
 *     if (!token) throw new HttpError(401, 'Unauthorized')
 *   },
 * })
 * ```
 */

export interface MiddlewareConfig {
  /** Middleware name — used for identification and debugging */
  name: string
  /** Execution priority — lower numbers run first (default: 10) */
  priority?: number
  /** The middleware handler — throw HttpError or Response to short-circuit */
  handle: (request: Request) => void | Promise<void>
}

export class Middleware {
  readonly name: string
  readonly priority: number
  readonly handle: (request: Request) => void | Promise<void>

  constructor(config: MiddlewareConfig) {
    this.name = config.name
    this.priority = config.priority ?? 10
    this.handle = config.handle
  }
}
