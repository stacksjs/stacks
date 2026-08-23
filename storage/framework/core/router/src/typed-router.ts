/**
 * Typed routes, bound to this application's router.
 *
 * The builder, the route-map contract and the client all live in
 * `@stacksjs/bun-router`, because none of them has a Stacks concept in them -
 * they are the Eden/`hc<>` layer, and that belongs in the router library where
 * every consumer of it benefits, not in a framework sitting on top.
 *
 * What is left here is the one thing that IS specific to Stacks: binding the
 * builder to the `route` singleton so a route file does not have to pass it,
 * and the fact that a Stacks `Action` is already the shape the builder reads.
 *
 * ## Why an Action just works
 *
 * `createTypedRouter()` reads a handler's input from a `validations` map and
 * its output from `handle`'s return type. An action is exactly
 * `{ handle, validations }`, and `Action`'s `TResult` parameter makes the
 * return type concrete rather than the whole `ActionResult` union - so an
 * action needs no adapter, no wrapper and no annotation:
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
 * import { createTypedClient } from '@stacksjs/router'
 *
 * const client = createTypedClient<AppRoutes>({ baseUrl: 'https://api.example.com' })
 * const projects = await client.get('/v1/projects')   // typed, no CLI step
 * ```
 *
 * Registration goes through the ordinary Stacks router, so there is exactly one
 * runtime dispatch path: the action is wrapped by the same `wrapAction` a
 * string-registered action goes through, and validation, `authorize`, `before`,
 * result formatting and error reporting are the same code for both.
 *
 * ## What it is not
 *
 * Not a replacement for `route.get(path, 'Actions/Foo')`, which stays exactly
 * as it is for every route that would rather be lazily imported than inferable.
 * Not a replacement for OpenAPI, which remains the answer for everything that
 * is not TypeScript in this repo - native iOS and Android through the Craft
 * bridge, third-party integrators, Swagger UI. Both are permanent; this is the
 * same-repo, TypeScript-to-TypeScript path.
 *
 * Routes registered here are visible to the OpenAPI generator too: the action
 * is recorded per route and reported by `listRegisteredRoutes()`, so the
 * generator reads its schema without needing a file path to import.
 */

import type { TypedRouter } from '@stacksjs/bun-router'
import type { StacksRouterInstance } from './stacks-router'
import { createTypedRouter as createBunTypedRouter } from '@stacksjs/bun-router'
import { route as defaultRoute } from './stacks-router'

/**
 * Build a typed route group on top of a Stacks router.
 *
 * Defaults to the shared `route` singleton, so a route file can use this and
 * the string form side by side and both land in the same table. Pass a router
 * explicitly when you are assembling one yourself (tests do this).
 */
export function createTypedRouter(router: StacksRouterInstance = defaultRoute): TypedRouter {
  return createBunTypedRouter(router)
}
