/**
 * Routes a TypeScript consumer can see the shape of, with no generation step.
 *
 * ## What this is for
 *
 * `route.get('/v1/projects', 'Actions/Project/IndexAction')` names its action
 * with a string that is resolved by a dynamic `import()` at request time. That
 * is a good trade for the runtime - lazy, hot-reload friendly, no eager import
 * of every action at boot - and it is completely opaque to the compiler. There
 * is no way to associate a path with an action's types when the only link
 * between them is a string, so the only route-aware client Stacks could offer
 * was one generated from an OpenAPI document by running a CLI command.
 *
 * A route registered through this builder imports its action instead, so the
 * compiler can see both ends. The route map accumulates into the builder's own
 * type as you chain, and `@stacksjs/api`'s `createTypedClient` reads it:
 *
 * ```ts
 * // routes/api.ts
 * import IndexAction from '../app/Actions/Project/IndexAction'
 * import StoreAction from '../app/Actions/Project/StoreAction'
 * import { createTypedRouter } from '@stacksjs/router'
 *
 * export const api = createTypedRouter()
 *   .get('/v1/projects', IndexAction)
 *   .post('/v1/projects', StoreAction, { middleware: 'auth' })
 *
 * export type AppRoutes = typeof api
 * ```
 *
 * ```ts
 * // any TypeScript consumer, same repo or a workspace package away
 * import type { AppRoutes } from '../routes/api'
 * import { createTypedClient } from '@stacksjs/api'
 *
 * const client = createTypedClient<AppRoutes>({ baseUrl: 'https://api.example.com' })
 * const projects = await client.get('/v1/projects')   // typed, no CLI step
 * ```
 *
 * ## What it is not
 *
 * Not a replacement for the string form, and not a replacement for OpenAPI.
 * The string form stays exactly as it is, for every route that would rather be
 * lazy than inferable. The OpenAPI document stays the answer for anything that
 * is not TypeScript in this repo - native iOS and Android through the Craft
 * bridge, third-party integrators, Swagger UI. This is the same-repo,
 * TypeScript-to-TypeScript path, and it is additive: registration goes through
 * the ordinary router, so there is exactly one runtime dispatch path and the
 * difference between the two forms is entirely at compile time.
 *
 * Routes registered here are also visible to the OpenAPI generator, which
 * reads the action off `listRegisteredRoutes()` rather than needing a file
 * path to import.
 *
 * ## Groups
 *
 * There is deliberately no `.group()` here. A prefix that exists only at
 * runtime would make every accumulated path type wrong, and a prefix that
 * exists only in the type would be a second place for the URL to be written
 * down. Write the full path; it is what the client will show you anyway.
 */

import type { Action, ActionValidations } from '@stacksjs/actions'
import type { ExtractParams, InferValidations, PathsForMethod, TypedRoute, TypedRouteMap } from '@stacksjs/types'
import type { ChainableRoute, RouterAction, StacksRouterInstance } from './stacks-router'
import { route as defaultRoute } from './stacks-router'

/** Any action, for constraint positions where the specifics do not matter. */
export type AnyAction = Action<any, any, any, any, any>

/**
 * What a client has to send for this action.
 *
 * From `validations`, which is the same object the validator runs, so the two
 * cannot drift. An action with no declared validations accepts anything, which
 * is the honest answer rather than a guess.
 */
export type ActionInput<A> = A extends Action<any, infer V, any, any, any>
  ? (V extends ActionValidations ? InferValidations<V> : Record<string, unknown>)
  : Record<string, unknown>

/**
 * What a client gets back.
 *
 * The action's own return type, inferred from its `handle`. An action that
 * returns a `Response` or a stream has decided to write the wire format
 * itself, so its shape is genuinely unknown here - saying `unknown` is the
 * accurate answer, and it is the one case where the typed client can tell you
 * less than reading the action would.
 */
export type ActionOutput<A> = A extends Action<any, any, any, any, infer R>
  ? ([R] extends [Response | ReadableStream] ? unknown : Awaited<R>)
  : unknown

// `TypedRoute` / `TypedRouteMap` live in `@stacksjs/types`: they are the
// contract this builder shares with the client in `@stacksjs/api`, and neither
// package should have to import the other to describe a route.
export type { TypedRoute, TypedRouteMap }

type Entry<P extends string, A> = {
  input: ActionInput<A>
  output: ActionOutput<A>
  params: ExtractParams<P>
}

/** Per-route settings, since the chainable form would break the type accumulation. */
export interface TypedRouteOptions {
  middleware?: string | readonly string[]
  name?: string
  skipCsrf?: boolean
  requireCsrf?: boolean
  rateLimit?: { max: number, window?: 'second' | 'minute' | 'hour' | 'day' | number }
}

/**
 * The builder. Each method returns the same object at runtime and a wider type
 * at compile time - the trick Hono and tRPC use, and the reason the route map
 * ends up in `typeof api` without anything being written down twice.
 */
export interface TypedRouter<R extends TypedRouteMap = {}> {
  /**
   * Phantom. Never set at runtime; it is where {@link RoutesOf} reads the
   * accumulated map from.
   */
  readonly __routes?: R

  get: <P extends string, A extends AnyAction>(path: P, action: A, options?: TypedRouteOptions)
  => TypedRouter<R & { [K in `GET ${P}`]: Entry<P, A> }>
  post: <P extends string, A extends AnyAction>(path: P, action: A, options?: TypedRouteOptions)
  => TypedRouter<R & { [K in `POST ${P}`]: Entry<P, A> }>
  put: <P extends string, A extends AnyAction>(path: P, action: A, options?: TypedRouteOptions)
  => TypedRouter<R & { [K in `PUT ${P}`]: Entry<P, A> }>
  patch: <P extends string, A extends AnyAction>(path: P, action: A, options?: TypedRouteOptions)
  => TypedRouter<R & { [K in `PATCH ${P}`]: Entry<P, A> }>
  delete: <P extends string, A extends AnyAction>(path: P, action: A, options?: TypedRouteOptions)
  => TypedRouter<R & { [K in `DELETE ${P}`]: Entry<P, A> }>
}

/** The accumulated route map, pulled back out of a builder's type. */
export type RoutesOf<T> = T extends TypedRouter<infer R> ? R : never

/** The paths a given method serves, as a union of literals. */
export type PathsFor<R extends TypedRouteMap, M extends string> = PathsForMethod<R, M>

const METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const

function applyOptions(chain: ChainableRoute, options?: TypedRouteOptions): void {
  if (!options)
    return
  if (options.middleware)
    chain.middleware(options.middleware as string | readonly string[])
  if (options.name)
    chain.name(options.name)
  if (options.skipCsrf)
    chain.skipCsrf()
  if (options.requireCsrf)
    chain.requireCsrf()
  if (options.rateLimit)
    chain.rateLimit(options.rateLimit.max, options.rateLimit.window ?? 'minute')
}

/**
 * Build a typed route group on top of an existing router.
 *
 * Defaults to the shared `route` singleton, so a route file can use this and
 * the string form side by side and both land in the same table. Pass a router
 * explicitly when you are assembling one yourself (tests do this).
 */
export function createTypedRouter(router: StacksRouterInstance = defaultRoute): TypedRouter {
  const builder = {} as Record<string, unknown>

  for (const method of METHODS) {
    builder[method] = (path: string, action: RouterAction, options?: TypedRouteOptions) => {
      applyOptions(router[method](path, action), options)
      return builder
    }
  }

  return builder as unknown as TypedRouter
}
