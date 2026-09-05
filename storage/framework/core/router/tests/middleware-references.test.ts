/**
 * How a middleware reference is read, end to end.
 *
 * Three things were wrong at once here, and each of them looked like it
 * worked:
 *
 *   1. `'env:production'` is an alias in `app/Middleware.ts`, and the parser
 *      split on the colon BEFORE consulting the alias map. So the reference
 *      resolved to `env` with a parameter of `production` - and `Env` accepts
 *      any of the six known environments and ignores parameters. A route
 *      marked production-only was open in local, dev and staging, and all six
 *      `env:*` aliases were unreachable.
 *   2. `'!auth'` is documented in `app/Middleware.ts`, legal in
 *      `MiddlewareReference`, and asserted to compile by a type-level test.
 *      Nothing implemented it, so it resolved to nothing and boot validation
 *      threw on it.
 *   3. The alias map REPLACED the framework defaults when the app had its own
 *      file, rather than merging over them - so every alias the framework
 *      added after a project was scaffolded was missing from that project.
 */

import { afterAll, beforeEach, describe, expect, test } from 'bun:test'
import { config } from '@stacksjs/config'
import { clearMiddlewareCache, clearRouteMiddlewareRegistry, createStacksRouter, findUnresolvableRouteMiddleware, middlewareAliases } from '../src/stacks-router'
import defaultAliases from '../../../defaults/app/Middleware'

beforeEach(() => {
  clearMiddlewareCache()
})

afterAll(() => {
  clearRouteMiddlewareRegistry()
})

describe('alias lookup happens before the colon is read as a parameter', () => {
  /**
   * Ask both routes under a stated environment.
   *
   * The environment is set rather than read, because "whichever environment
   * this runs in, one of these two passes" is only true in two of the six.
   * Under `APP_ENV=development` — this repository's own default — neither
   * `env:production` nor `env:local` should allow anything, and a test that
   * demanded exactly one 200 failed on correct behaviour.
   */
  async function statusesUnder(env: string): Promise<{ production: number, local: number }> {
    const previous = config.app.env
    config.app.env = env as typeof config.app.env

    try {
      clearMiddlewareCache()

      const router = createStacksRouter()
      router.get('/mw-env-prod', (() => ({ ok: true })) as any).middleware('env:production')
      router.get('/mw-env-local', (() => ({ ok: true })) as any).middleware('env:local')

      return {
        production: (await router.handleRequest(new Request('http://localhost/mw-env-prod'))).status,
        local: (await router.handleRequest(new Request('http://localhost/mw-env-local'))).status,
      }
    }
    finally {
      config.app.env = previous
    }
  }

  test('each env alias allows only its own environment', async () => {
    // Pre-fix every one of these was 200: the colon was read as a parameter
    // separator before the alias map was consulted, so both references
    // resolved to `Env`, which accepts every known environment and ignores
    // parameters outright.
    expect(await statusesUnder('production')).toEqual({ production: 200, local: 403 })
    expect(await statusesUnder('local')).toEqual({ production: 403, local: 200 })

    // And in an environment that is neither, neither route opens — the case
    // this test used to run in without noticing.
    expect(await statusesUnder('development')).toEqual({ production: 403, local: 403 })
  })

  test('throttle:60,1 still splits, because it is not an alias of its own', async () => {
    const router = createStacksRouter()
    router.get('/mw-throttle', (() => ({ ok: true })) as any).middleware('throttle:60,1')

    const res = await router.handleRequest(new Request('http://localhost/mw-throttle'))
    expect(res.status).toBe(200)
  })
})

describe('negated references', () => {
  test('warm handlers and reloaded handlers enforce the current request environment', async () => {
    const previous = config.app.env
    const router = createStacksRouter()
    router.get('/mw-cache-prod', () => ({ ok: true })).middleware('env:production')
    router.get('/mw-cache-not-prod', () => ({ ok: true })).middleware('!env:production')

    try {
      for (let cycle = 0; cycle < 2; cycle++) {
        clearMiddlewareCache()
        for (const env of ['production', 'local', 'production']) {
          config.app.env = env as typeof config.app.env
          const allowed = await router.handleRequest(new Request('http://localhost/mw-cache-prod'))
          const negated = await router.handleRequest(new Request('http://localhost/mw-cache-not-prod'))
          expect(allowed.status).toBe(env === 'production' ? 200 : 403)
          expect(negated.status).toBe(env === 'production' ? 403 : 200)
        }
      }
    }
    finally {
      config.app.env = previous
      clearMiddlewareCache()
    }
  })

  test('!auth passes when auth refuses', async () => {
    const router = createStacksRouter()
    let handlerRan = false
    router.get('/mw-guest-only', (() => {
      handlerRan = true
      return { ok: true }
    }) as any).middleware('!auth')

    // No credentials, so `auth` refuses - which is exactly what `!auth` wants.
    const res = await router.handleRequest(new Request('http://localhost/mw-guest-only'))

    expect(res.status).toBe(200)
    expect(handlerRan).toBe(true)
  })

  test('a negated middleware that passes refuses the route', async () => {
    const router = createStacksRouter()
    let handlerRan = false
    router.get('/mw-not-logger', (() => {
      handlerRan = true
      return { ok: true }
    }) as any).middleware('!logger')

    // `logger` never refuses, so its negation always does.
    const res = await router.handleRequest(new Request('http://localhost/mw-not-logger'))

    expect(res.status).toBe(403)
    expect(handlerRan).toBe(false)
  })

  test('a negated reference is not reported as unresolvable', async () => {
    const router = createStacksRouter()
    router.get('/mw-neg-resolvable', (() => ({})) as any).middleware('!auth')

    const unresolvable = await findUnresolvableRouteMiddleware()
    expect(unresolvable.map(u => u.alias)).not.toContain('!auth')
  })

  test('negating a middleware that does not exist is still unresolvable', async () => {
    const router = createStacksRouter()
    router.get('/mw-neg-bad', (() => ({})) as any).middleware('!definitely-not-real' as any)

    const unresolvable = await findUnresolvableRouteMiddleware()
    expect(unresolvable.map(u => u.alias)).toContain('!definitely-not-real')
  })
})

describe('the alias map merges over the framework defaults', () => {
  test('every default alias survives the application having its own map', async () => {
    const merged = await middlewareAliases()

    for (const [alias, className] of Object.entries(defaultAliases))
      expect(merged[alias]).toBe(className)
  })

  test('an unaliased middleware is still reachable by its class name', async () => {
    const router = createStacksRouter()
    router.get('/mw-by-class', (() => ({})) as any).middleware('EnvNotProduction')

    const unresolvable = await findUnresolvableRouteMiddleware()
    expect(unresolvable.map(u => u.alias)).not.toContain('EnvNotProduction')
  })
})
