/**
 * A compiled app carries its middleware inside itself.
 *
 * The router finds a middleware by importing its file off disk: the
 * auto-import registry, then `app/Middleware/`, then the framework defaults.
 * A compiled binary has no project tree beside it, so every route behind
 * `.middleware('auth')` answered 500 there. `provideMiddleware` is how the
 * build hands the router loaders it imported statically, the way
 * `provideActions` does for actions.
 *
 * Driven through a real server: what matters is that a route behind a
 * provided middleware runs it, and answers what it decides.
 */

import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { clearMiddlewareCache, clearRouteMiddlewareRegistry } from '../src/stacks-router'

let server: any = null
let port = 0
const seen: string[] = []

beforeAll(async () => {
  clearRouteMiddlewareRegistry()
  const { provideMiddleware, createStacksRouter } = await import('../src')
  const route = createStacksRouter()

  provideMiddleware({
    // By class name, as a build registers them.
    ProvidedGate: async () => ({
      default: {
        name: 'provided-gate',
        handle: (request: Request) => {
          seen.push('gate')
          if (request.headers.get('x-let-me-in') !== 'yes')
            throw Object.assign(new Error('Not allowed in.'), { statusCode: 403 })
        },
      },
    }),
    // A module with nothing usable in it: must fail closed, not be skipped.
    ProvidedBroken: async () => ({ default: { name: 'broken' } }),
  })

  await route.get('/provided/open', () => ({ ok: true })).middleware('ProvidedGate' as any)
  await route.get('/provided/broken', () => ({ ok: true })).middleware('ProvidedBroken' as any)

  server = Bun.serve({ port: 0, fetch: (request: Request) => route.handleRequest(request) })
  port = server.port
})

afterAll(() => {
  server?.stop(true)
  clearRouteMiddlewareRegistry()
  clearMiddlewareCache()
})

describe('middleware a build provides', () => {
  it('runs for a route that names it, and lets the request through', async () => {
    const response = await fetch(`http://127.0.0.1:${port}/provided/open`, { headers: { 'x-let-me-in': 'yes' } })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expect(seen).toContain('gate')
  })

  it('answers what the middleware decides when it refuses', async () => {
    const response = await fetch(`http://127.0.0.1:${port}/provided/open`)

    expect(response.status).toBe(403)
  })

  it('fails closed when the provided module has no handle()', async () => {
    const response = await fetch(`http://127.0.0.1:${port}/provided/broken`)

    expect(response.status).toBeGreaterThanOrEqual(500)
  })
})
