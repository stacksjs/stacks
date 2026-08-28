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

/**
 * Augmentation target: every middleware class this application can load.
 *
 * The keys are class names as they appear on disk without the extension -
 * `'Auth'`, `'EnsureEmailIsVerified'` - under `app/Middleware/` or the
 * framework defaults behind it. `buddy generate:types` writes the
 * augmentation into `storage/framework/types/actions.d.ts`, from the same
 * directories `loadMiddleware` searches, so an alias map cannot name a class
 * that is not there.
 *
 * @example
 * ```ts
 * declare module '@stacksjs/router' {
 *   interface MiddlewareClasses {
 *     'Auth': true
 *   }
 * }
 * ```
 */
// eslint-disable-next-line ts/no-empty-object-type -- augmentation target; empty by design
export interface MiddlewareClasses {}

/**
 * A middleware class name, as narrow as the application has made it.
 *
 * Falls back to `string` while `MiddlewareClasses` is empty, so a project that
 * has not run `generate:types` yet still compiles.
 */
export type MiddlewareClassName = keyof MiddlewareClasses extends never
  ? string
  : keyof MiddlewareClasses & string

/**
 * The `app/Middleware.ts` map: an alias to the middleware class it names.
 *
 * The alias is the application's to invent, so the key stays `string`. The
 * value is not: it has to be a file on disk, and it used to be `string` -
 * declared, of all places, inside `app/Middleware.ts` itself as
 * `interface Middleware { [key: string]: string }`. A typo in a class name
 * type-checked and then failed at the only moment that matters, when a request
 * needed the middleware that was supposed to be guarding the route.
 */
export type MiddlewareAliases = Readonly<Record<string, MiddlewareClassName>>

/**
 * Define the application's middleware alias map.
 *
 * Aliases may be used instead of class names to conveniently assign middleware
 * to routes and groups. The class each one names is checked against what is on
 * disk, and the literal aliases are kept, so `keyof typeof middleware` is the
 * set the file declares.
 *
 * @example
 * ```ts
 * // app/Middleware.ts
 * import { defineMiddleware } from '@stacksjs/router'
 *
 * export default defineMiddleware({
 *   auth: 'Auth',
 *   verified: 'EnsureEmailIsVerified',
 * })
 * ```
 *
 * An alias is looked up whole before its colon is read as a parameter
 * separator, so `'env:production'` may be an alias of its own and
 * `'throttle:60,1'` still passes `60,1` to `throttle`.
 */
export function defineMiddleware<const T extends MiddlewareAliases>(aliases: T): T {
  return aliases
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
