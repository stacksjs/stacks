/**
 * Middleware fail-closed coverage (stacksjs/stacks#1957).
 *
 * Pre-fix, an unresolvable middleware alias (typo'd name, missing file,
 * file without a default export) was silently SKIPPED by the request-time
 * chain builder — `.middleware('atuh')` served the route unprotected.
 *
 * Two layers are locked in here:
 *   1. Request-time: a route whose middleware can't be resolved returns
 *      500 and the handler never runs (the guarantee, covering every
 *      entry point including dev hot-reload cache clears).
 *   2. Boot-time: findUnresolvableRouteMiddleware() /
 *      assertRouteMiddlewareResolvable() report/throw on bad aliases so
 *      importRoutes() and the compiled-binary boot abort loudly instead
 *      of serving.
 *
 * Note: the route middleware registry is module-scoped, so aliases
 * registered by earlier tests stay visible to the boot-validation
 * helpers — assertions check membership, not exact equality.
 */

import { beforeEach, describe, expect, test } from 'bun:test'
import { assertRouteMiddlewareResolvable, clearMiddlewareCache, createStacksRouter, findUnresolvableRouteMiddleware } from '../src/stacks-router'

beforeEach(() => {
  clearMiddlewareCache()
})

describe('request-time fail-closed', () => {
  test('resolvable alias → middleware runs, handler runs, 200', async () => {
    const router = createStacksRouter()
    let handlerRan = false
    router.get('/mw-ok', (() => {
      handlerRan = true
      return { ok: true }
    }) as any).middleware('logger')

    const res = await router.handleRequest(new Request('http://localhost/mw-ok'))
    expect(res.status).toBe(200)
    expect(handlerRan).toBe(true)
  })

  test('unresolvable alias → 500 and the handler NEVER runs (no silent skip)', async () => {
    const router = createStacksRouter()
    let handlerRan = false
    router.get('/mw-bad', (() => {
      handlerRan = true
      return { ok: true }
    }) as any).middleware('definitely-not-real')

    const res = await router.handleRequest(new Request('http://localhost/mw-bad'))
    expect(res.status).toBe(500)
    expect(handlerRan).toBe(false)
  })
})

describe('boot-time validation', () => {
  test('resolvable aliases are not reported (alias map, PascalCase fallback, param form)', async () => {
    const router = createStacksRouter()
    router.get('/mw-auth', (() => ({})) as any).middleware('auth')
    // `signed` is NOT in the alias map — resolves via the toPascalCase
    // file-lookup fallback (defaults/app/Middleware/Signed.ts).
    router.get('/mw-signed', (() => ({})) as any).middleware('signed')
    // Param form must validate the base alias, not the literal string.
    router.get('/mw-throttled', (() => ({})) as any).middleware('throttle:60,1')

    const unresolvable = await findUnresolvableRouteMiddleware()
    const aliases = unresolvable.map(u => u.alias)
    expect(aliases).not.toContain('auth')
    expect(aliases).not.toContain('signed')
    expect(aliases).not.toContain('throttle')
    expect(aliases).not.toContain('throttle:60,1')
    // csrf is always validated (auto-injected on unsafe methods) and must
    // resolve from the defaults.
    expect(aliases).not.toContain('csrf')
  })

  test('findUnresolvableRouteMiddleware reports a bad alias with its route key', async () => {
    const router = createStacksRouter()
    router.get('/mw-typo', (() => ({})) as any).middleware('no-such-mw')

    const unresolvable = await findUnresolvableRouteMiddleware()
    const entry = unresolvable.find(u => u.alias === 'no-such-mw')
    expect(entry).toBeDefined()
    expect(entry!.routes).toContain('GET:/mw-typo')
  })

  test('assertRouteMiddlewareResolvable rejects naming the bad alias and its route', async () => {
    // 'no-such-mw' was registered by the previous test (module-scoped
    // registry) — the assertion must surface it.
    expect(assertRouteMiddlewareResolvable()).rejects.toThrow(/no-such-mw/)
    await expect(assertRouteMiddlewareResolvable()).rejects.toThrow(/GET:\/mw-typo/)
  })
})
