/**
 * Module augmentation: extend `@stacksjs/bun-router`'s `EnhancedRequest`
 * with the marker fields and macro methods Stacks attaches at runtime.
 *
 * Without this file, every read or write of one of these properties
 * required an `as any` cast (~70 sites in `stacks-router.ts` alone)
 * because the bun-router `EnhancedRequest` type didn't know about them.
 * Casting silenced the type system but also masked real bugs: a renamed
 * marker (`_authenticatedUser` → `_authUser`) would compile clean and
 * fail silently at runtime.
 *
 * This file declares each Stacks marker once and merges them into the
 * underlying interface via TypeScript's declaration merging. After
 * importing this file (anywhere — once per process is enough), reads
 * like `req._corsConfig` and writes like `req._requestId = id`
 * type-check without casts.
 *
 * The augmentation is purely additive — bun-router's existing surface
 * (`params`, `query`, `jsonBody`, `formBody`, `RequestMacroMethods`,
 * etc.) stays as-is, just intersected with Stacks's overlay.
 *
 * stacksjs/stacks#1863 (T-3).
 */

import type { FileInfo } from '@stacksjs/bun-router'
import type { Collection } from '@stacksjs/types'

/**
 * Stacks-specific marker fields attached to the request by the
 * router itself and the framework's default middleware.
 *
 * Markers are deliberately prefixed with `_` so they can't collide
 * with userland keys on the request, and their lifetimes are bounded
 * by the request's lifetime — they're never persisted.
 */
export interface StacksRequestMarkers {
  /**
   * CORS configuration attached by the Cors middleware. Read by the
   * post-response wrapper in `stacks-router.ts` to apply the headers
   * to the final response. Carries the resolved policy (origin
   * allowlist, methods, etc.) so error responses don't need to re-
   * resolve config.
   */
  _corsConfig?: unknown

  /**
   * Set when the action exported `apiResponse: true` (or when the
   * route group declared it). Signals `formatResult` to skip
   * Accept-header negotiation and always emit JSON. The action-level
   * flag wins over the group-level flag.
   */
  _forceJson?: boolean

  /**
   * Set when the action exported `skipCsrf: true` / `csrf: false`,
   * the route called `.skipCsrf()`, or the route's bearer-token
   * bypass applied. Read by the CSRF middleware to short-circuit
   * (the middleware is only injected when the flag is false, but
   * defensive bail keeps the contract symmetrical).
   */
  _skipCsrf?: boolean

  /**
   * Set when the action exported `compress: true` (or matching
   * route flag). The post-response Compress middleware reads this to
   * decide whether to gzip/brotli the body.
   */
  _compress?: boolean

  /**
   * Map of middleware-name → params parsed from a route's middleware
   * string. `route.middleware('abilities:read,write')` lands as
   * `{ abilities: 'read,write' }` so the resolved Middleware instance
   * can consult it via `request._middlewareParams.abilities`.
   */
  _middlewareParams?: Record<string, string>

  /**
   * Per-request unique ID stamped by the X-Request-ID middleware (or
   * generated server-side). Echoed back in response headers + every
   * log line for cross-system request correlation.
   */
  _requestId?: string

  /**
   * `process.hrtime.bigint()` taken at request entry. Used by the
   * post-handler `Server-Timing` builder to compute `total;dur=...`.
   */
  _startNs?: bigint

  /**
   * Authenticated user resolved by the Auth middleware. Stamped so
   * downstream code can read the user without re-running the
   * middleware. `unknown` because the User shape is project-defined.
   */
  /**
   * Validation rules attached by `request.validate()`, read back by the
   * error handler to shape a 422 body.
   */
  _requestValidationRules?: unknown

  /** Memoised `all()` payload, so repeated reads do not re-parse the body. */
  _allInputCache?: unknown

  /** Previous request's input, for `old()` after a redirect-back. */
  _oldInput?: unknown

  /**
   * The input `validate()` accepted, cached so a handler reading it twice does
   * not revalidate. Stamped and read by the router itself.
   */
  _validatedInput?: unknown

  _authenticatedUser?: unknown

  /**
   * The access token row matched against the bearer token by the
   * Auth middleware. Used by `request.userToken()` / `tokenCan()`.
   */
  _currentAccessToken?: unknown

  /**
   * Set true once `parseRequestBody` has run on this request so the
   * middleware chain doesn't re-parse JSON / multipart bodies twice.
   */
  _bodyParsed?: boolean

  /**
   * Headers a middleware wants on the outgoing response.
   *
   * The middleware pipeline runs before the action and cannot see what it
   * returned, so a middleware with something to say *about the answer* - a rate
   * limit's remaining count, a cache verdict, a deprecation notice - had
   * nowhere to put it. Compression got a hard-coded post-action wrapper;
   * everything else had to wrap every action in the app.
   *
   * Written by a middleware, applied by the router. The router's own headers
   * (`X-Request-ID`, `Server-Timing`) win a collision, because correlation is
   * this layer's to state.
   */
  _responseHeaders?: Record<string, string>

  /**
   * Callbacks to run once the response is known.
   *
   * The other half of what a pre-action middleware pipeline cannot do: the
   * header seam covers "put this on the response", this covers "record that
   * this happened". Metrics are the obvious case - a middleware can time the
   * start of a request and has no way to learn its status or duration.
   *
   * A callback that throws is swallowed: an observation is worth less than the
   * request it observes.
   */
  _afterResponse?: Array<(outcome: { status: number, durationMs: number }) => void>
}

/**
 * Laravel-style request-input macros that Stacks attaches in
 * `enhanceRequest` (router/src/stacks-router.ts). These shadow some
 * of bun-router's `RequestMacroMethods` with Stacks-specific
 * implementations (more permissive `T = any` generics so action
 * callers don't have to specify the return type for every read).
 *
 * Listed here as part of the augmentation so call sites like
 * `request.input(key)` type-check without `as any`.
 */
export interface StacksRequestMacros {
  /** Read a single input value across query / body / form / params. */
  input?: <T = unknown>(key: string, defaultValue?: T) => T
  /** Alias of `input` for Laravel parity. */
  get?: <T = unknown>(key: string, defaultValue?: T) => T
  /** Read all input merged from query / body / form / params. */
  all?: () => Record<string, unknown>
  /** Read only the listed keys. */
  only?: <T extends Record<string, unknown>>(keys: string[]) => T
  /** Read everything except the listed keys. */
  except?: <T extends Record<string, unknown>>(keys: string[]) => T
  /** Whether all of the given key(s) are present. */
  has?: (key: string | string[]) => boolean
  /** Whether any of the given keys are present. */
  hasAny?: (keys: string[]) => boolean
  /** Inverse of `has`. */
  missing?: (key: string | string[]) => boolean
  /** Whether the key is present AND its value is non-empty. */
  filled?: (key: string | string[]) => boolean
  /** Merge additional values into the request input. */
  merge?: (data: Record<string, unknown>) => void
  /** Get every merged input key. */
  keys?: () => string[]

  /** Coerce input to integer. */
  integer?: (key: string, defaultValue?: number) => number
  /** Coerce input to float. */
  float?: (key: string, defaultValue?: number) => number
  /** Coerce input to boolean. */
  boolean?: (key: string, defaultValue?: boolean) => boolean
  /** Coerce input to string. */
  string?: (key: string, defaultValue?: string) => string
  /** Coerce input to array. */
  array?: <T = unknown>(key: string) => T[]
  /** Parse a date input, returning null when it is absent or invalid. */
  date?: (key: string, format?: string) => Date | null
  /** Match input to a value or key from an enum-like object. */
  enum?: <T extends Record<string, string | number>>(key: string, enumType: T) => T[keyof T] | null
  /** Wrap scalar or array input in the native Stacks collection. */
  collect?: <T = unknown>(key: string) => Collection<T>
  /** Run a callback when an input key exists. */
  whenHas?: <T>(key: string, callback: (value: T) => void, defaultCallback?: () => void) => void
  /** Run a callback when an input value is not empty. */
  whenFilled?: <T>(key: string, callback: (value: T) => void, defaultCallback?: () => void) => void
  /** Compare an input value without coercion. */
  isValue?: (key: string, value: unknown) => boolean
  /**
   * Validate the request against `rules`, or against the rules the route
   * attached if none are given.
   *
   * The macro has always existed on the request - `stacks-router.ts` defines
   * it beside `isValue` above - but was never declared here, so every caller
   * had to reach it through a cast. `Controller.validate` did, which is how it
   * came to call it with the wrong arity and a local `type Request = any`
   * standing in for the request.
   */
  validate?: (_rules?: Record<string, unknown>, _messages?: Record<string, string>) => Promise<unknown>

  /** Get a single uploaded file by field name. */
  file?: (key: string) => FileInfo | null
  /** Get all uploaded files for a field name. */
  getFiles?: (key: string) => FileInfo[]
  /** Whether the field has at least one uploaded file. */
  hasFile?: (key: string) => boolean
  /** Snapshot of all uploaded files keyed by field name. */
  allFiles?: () => Record<string, FileInfo | FileInfo[]>

  /**
   * The authenticated user (resolved lazily — falls back to the
   * cached `_authenticatedUser` marker when available).
   */
  user?: () => Promise<unknown>
  /** The active access-token row matching the bearer. */
  userToken?: () => Promise<unknown>
  /** Whether the active token grants `ability`. */
  tokenCan?: (ability: string) => Promise<boolean>
  /** Inverse of `tokenCan`. */
  tokenCant?: (ability: string) => Promise<boolean>

  /**
   * Gate / Policy macros (stacksjs/stacks#1874 F-9). Resolve the
   * authenticated user from the request, then delegate to
   * `@stacksjs/auth`'s Gate / Policy resolver. Mirrors Laravel's
   * `$request->user()->can(...)` / `$this->authorize(...)` shape but
   * skips the extra `user()` hop.
   *
   * @example
   * ```ts
   * // Boolean check — handler stays in control of the response.
   * if (await req.cannot('update', post)) {
   *   return Response.json({ error: 'forbidden' }, { status: 403 })
   * }
   *
   * // Throw-on-deny — bubbles a 403 via AuthorizationException.
   * await req.authorize('update', post)
   * post.title = body.title
   * ```
   */
  can?: (ability: string, ...args: unknown[]) => Promise<boolean>
  /** Inverse of `can`. */
  cannot?: (ability: string, ...args: unknown[]) => Promise<boolean>
  /**
   * Throws `AuthorizationException` (status 403) if the user cannot
   * perform the ability. Equivalent to Laravel's `$this->authorize(...)`.
   */
  authorize?: (ability: string, ...args: unknown[]) => Promise<void>
}

/**
 * Union of Stacks markers + macros — useful as a single type alias for
 * places that previously cast to `any`.
 */
export type StacksRequestExtensions = StacksRequestMarkers & StacksRequestMacros

declare module '@stacksjs/bun-router' {
  // eslint-disable-next-line ts/no-empty-object-type
  interface EnhancedRequest extends StacksRequestMarkers {
    allFiles?: StacksRequestMacros['allFiles']
    tokenCan?: StacksRequestMacros['tokenCan']
    can?: StacksRequestMacros['can']
    validate?: StacksRequestMacros['validate']
  }
}
