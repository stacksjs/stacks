/**
 * The strings that are really identifiers, checked at compile time.
 *
 * An action path names a file, a middleware alias names a class, a route name
 * names a route. All three were `string`, so a typo in the first is a 500 on
 * one endpoint, a typo in the third throws when the URL is built, and a typo in
 * the second serves the route WITHOUT the middleware you thought was on it.
 *
 * `buddy generate:types` discovers all three from what the application actually
 * has and writes them into the router's type registry
 * (`storage/framework/types/actions.d.ts`). This asserts the wiring holds -
 * that the generated declaration reaches the call sites and bites.
 *
 * Checked by `bun run typecheck` via `tsconfig.type-tests.json`; nothing here
 * executes. The `@ts-expect-error` lines are the load-bearing half: each fails
 * the build if the error it expects stops happening, which is what catches the
 * failure mode this whole feature kept hitting - a registry that looks wired up
 * and checks nothing.
 */

import { route, url } from '@stacksjs/router'

// ── action paths ──────────────────────────────────────────────────────────

route.get('/typed/login', 'Actions/Auth/LoginAction')
// Not every action file ends in `Action`; the union is the real list, not a
// pattern, so these have to work too.
route.get('/typed/models', 'Actions/Dashboard/Models/GetModels')
// Controllers stay a pattern - the method half is a member name, not a file.
route.get('/typed/query', 'Controllers/QueryController@getStats')

export function badActions(): void {
  // @ts-expect-error typo'd action: no such file
  route.get('/typed/x', 'Actions/Auth/LogniAction')

  // @ts-expect-error right shape, still not an action this app has
  route.get('/typed/y', 'Actions/Totally/MadeUpAction')
}

// ── middleware aliases ────────────────────────────────────────────────────

route.get('/typed/dash', () => ({ ok: true })).middleware('auth')
route.get('/typed/dash2', () => ({ ok: true })).middleware(['auth', 'team'])
// Parameterised and negated forms are both real.
route.get('/typed/dash3', () => ({ ok: true })).middleware('throttle:60,1')
route.get('/typed/dash4', () => ({ ok: true })).middleware('!auth')

export function badMiddleware(): void {
  // @ts-expect-error the typo that silently serves a route unprotected
  route.get('/typed/admin', () => ({ ok: true })).middleware('atuh')
}

// ── named routes ──────────────────────────────────────────────────────────

export const unsubscribe: string = url('email.unsubscribe', { token: 'abc-123' })
export const contact: string = url('contact.send')

export function badNames(): void {
  // @ts-expect-error no route is called this
  url('email.unsubscrbe')

  // @ts-expect-error nor this
  url('users.show')
}
