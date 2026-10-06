import { describe, expect, it } from 'bun:test'
import { createStacksRouter } from '../src/stacks-router'

/**
 * The router recognises its CSRF cookie by exact name.
 *
 * `hasCsrfCookie` was a substring test, so a jar holding NextAuth's
 * `next-auth.csrf-token` (cookies are not port-scoped, so it follows a
 * developer across every localhost app) looked like it already had a token.
 * No `X-CSRF-Token` cookie was ever set, the token read back empty, and every
 * form post failed with 403.
 */
describe('the CSRF cookie, by name', () => {
  it.each([false, true])('is seeded beside a cookie that only ends in csrf-token (nativeRoutes=%s)', async (nativeRoutes) => {
    const router = createStacksRouter({ autoDiscoverRoutes: false })
    router.get(`/csrf-name-${nativeRoutes}`, () => new Response('<form></form>', { headers: { 'Content-Type': 'text/html' } }))
    const server = await router.serve({ port: 0, hostname: '127.0.0.1', nativeRoutes })
    try {
      const response = await fetch(`http://127.0.0.1:${server.port}/csrf-name-${nativeRoutes}`, {
        headers: { accept: 'text/html', cookie: 'next-auth.csrf-token=abc%7Cdef' },
      })
      expect(response.status).toBe(200)
      expect(response.headers.get('set-cookie') ?? '').toContain('X-CSRF-Token=')
    }
    finally {
      server.stop()
    }
  })
})
