import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { config } from '@stacksjs/config'
import { createStacksRouter } from '../src/stacks-router'

/**
 * A preflight is answered by `config/cors.ts`, routed or not.
 *
 * bun-router answered every preflight for a path with no OPTIONS route
 * itself - which is every path, since Stacks registers none - reflecting any
 * Origin with `Access-Control-Allow-Credentials: true`. The Cors middleware
 * never ran, so `{ origin: ['https://good.test'], credentials: true }` let a
 * browser send credentialed PUTs and JSON POSTs from any site.
 */
let saved: unknown

beforeEach(() => {
  saved = (config as any).cors
  ;(config as any).cors = { origin: ['https://good.test'], credentials: true, allowedHeaders: ['Content-Type'] }
})

afterEach(() => {
  ;(config as any).cors = saved
})

function preflight(port: number, path: string, origin: string): Promise<Response> {
  return fetch(`http://127.0.0.1:${port}${path}`, {
    method: 'OPTIONS',
    headers: { 'Origin': origin, 'Access-Control-Request-Method': 'PUT', 'Access-Control-Request-Headers': 'content-type' },
  })
}

describe('CORS preflights', () => {
  it.each([false, true])('follow config/cors.ts (nativeRoutes=%s)', async (nativeRoutes) => {
    const router = createStacksRouter({ autoDiscoverRoutes: false })
    router.put(`/items-${nativeRoutes}/{id}`, () => ({ ok: true }))
    const server = await router.serve({ port: 0, hostname: '127.0.0.1', nativeRoutes })
    try {
      for (const path of [`/items-${nativeRoutes}/1`, `/nowhere-${nativeRoutes}`]) {
        const evil = await preflight(server.port, path, 'https://evil.test')
        expect(evil.headers.get('access-control-allow-origin')).toBeNull()
        expect(evil.headers.get('access-control-allow-credentials')).toBeNull()

        const good = await preflight(server.port, path, 'https://good.test')
        expect(good.headers.get('access-control-allow-origin')).toBe('https://good.test')
        expect(good.headers.get('access-control-allow-credentials')).toBe('true')
      }
    }
    finally {
      server.stop()
    }
  })
})
