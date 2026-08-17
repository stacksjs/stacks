/**
 * A duplicate registration must not reach the live route (stacksjs/stacks#2332).
 *
 * bun-router serves the FIRST registration of a `METHOD:/path` and discards
 * the second. But the Stacks registries beside it - middleware, apiResponse,
 * CSRF-skip, handler-key - are keyed by `METHOD:/path` alone, so the discarded
 * registration used to write straight into the live route's state.
 *
 * That silently broke the override model `route-loader.ts` documents. It loads
 * user routes BEFORE framework defaults precisely so a user route wins, and a
 * user's public `route.get('/dashboard/home', ...)` answered 401 Unauthorized,
 * because the framework's later duplicate inside
 * `route.group({ middleware: 'auth' }, ...)` stamped `auth` onto it.
 *
 * The CSRF direction is worse: a dead duplicate calling `.skipCsrf()` turned
 * the check off for a live route that never asked.
 */

import { beforeEach, describe, expect, test } from 'bun:test'
import { clearMiddlewareCache, clearRouteMiddlewareRegistry, createStacksRouter, url } from '../src/stacks-router'

beforeEach(() => {
  clearMiddlewareCache()
  clearRouteMiddlewareRegistry()
})

/** A path per test, so module-scoped registries cannot leak between them. */
let counter = 0
function uniquePath(): string {
  counter += 1
  return `/dup-${process.pid}-${counter}`
}

describe('a shadowed registration cannot modify the live route (#2332)', () => {
  test('group middleware from a dead duplicate does not attach to the live route', async () => {
    const router = createStacksRouter()
    const path = uniquePath()

    // First registration wins and is deliberately unguarded.
    router.get(path, () => new Response('LIVE'))

    // The shadowed one, inside an auth group - the shape the framework's
    // default routes use, and what turned a user's public page into a 401.
    router.group({ middleware: 'auth' }, () => {
      router.get(path, () => new Response('SHADOWED'))
    })

    const res = await router.handleRequest(new Request(`http://localhost${path}`))

    expect(res.status).toBe(200)
    expect(await res.text()).toBe('LIVE')
  })

  test('.middleware() called on a dead duplicate does not attach either', async () => {
    const router = createStacksRouter()
    const path = uniquePath()

    router.get(path, () => new Response('LIVE'))
    router.get(path, () => new Response('SHADOWED')).middleware('auth')

    const res = await router.handleRequest(new Request(`http://localhost${path}`))

    expect(res.status).toBe(200)
    expect(await res.text()).toBe('LIVE')
  })

  test('.skipCsrf() on a dead duplicate does not disable CSRF on the live route', async () => {
    const router = createStacksRouter()
    const path = uniquePath()

    // The live route never opted out, so the default-on CSRF check must still
    // reject a cookie-less POST.
    router.post(path, () => new Response('LIVE'))
    router.post(path, () => new Response('SHADOWED')).skipCsrf()

    const res = await router.handleRequest(new Request(`http://localhost${path}`, { method: 'POST' }))

    expect(res.status).not.toBe(200)
  })

  test('the live route keeps the middleware IT declared', async () => {
    // The guard must not overshoot: a first registration still gets its own
    // group middleware. Without this, the fix would strip auth from every
    // protected framework route rather than only from shadowed ones.
    const router = createStacksRouter()
    const path = uniquePath()

    router.group({ middleware: 'auth' }, () => {
      router.get(path, () => new Response('LIVE'))
    })

    const res = await router.handleRequest(new Request(`http://localhost${path}`))

    expect(res.status).toBe(401)
  })
})

describe('the shadow test is per router instance, not per module (#2332)', () => {
  test('a second router registering the same path is still live, not inert', () => {
    // bun-router dedupes per INSTANCE, so the same path on a second router is
    // genuinely served by that router. Tracking registered keys at module
    // scope would mark it shadowed and return an inert chain, so `.name()`
    // would quietly do nothing and `url()` could not resolve it.
    //
    // This is the shape `stacks-router.test.ts`'s `url()` tests already use -
    // several of them build a fresh router and re-register
    // `/api/email/unsubscribe` - which is how a module-scoped guard was caught.
    const path = uniquePath()

    const first = createStacksRouter()
    first.get(path, () => new Response('FIRST')).name('dup.first')

    const second = createStacksRouter()
    second.get(path, () => new Response('SECOND')).name('dup.second')

    expect(url('dup.first')).toContain(path)
    expect(url('dup.second')).toContain(path)
  })
})

/**
 * Not covered here, and deliberately: the middleware/apiResponse/CSRF
 * registries are MODULE-scoped and keyed by `METHOD:/path` alone, so two
 * router instances sharing a path also share those entries. Measured
 * identical before and after this change, so it is pre-existing and out of
 * scope for #2332 - but it means cross-instance middleware isolation does not
 * exist today, and a test asserting it would be asserting a wish.
 */

