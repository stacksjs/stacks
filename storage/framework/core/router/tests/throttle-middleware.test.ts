import { expect, test } from 'bun:test'
import { createStacksRouter } from '../src/stacks-router'

for (const nativeRoutes of [false, true]) {
  test(`default throttle preserves its rejection body and headers (nativeRoutes=${nativeRoutes})`, async () => {
    const router = createStacksRouter({ autoDiscoverRoutes: false })
    const path = `/default-throttle-${nativeRoutes}`
    let calls = 0
    router.get(path, () => ({ calls: ++calls })).middleware(`throttle:1,${nativeRoutes ? 72 : 71}`)
    const server = await router.serve({ port: 0, hostname: '127.0.0.1', nativeRoutes })

    try {
      const url = `http://127.0.0.1:${server.port}${path}`
      const first = await fetch(url)
      expect(first.status).toBe(200)
      expect(await first.json()).toEqual({ calls: 1 })

      for (let attempt = 0; attempt < 3; attempt++) {
        const denied = await fetch(url)
        const retryAfter = denied.headers.get('retry-after')
        expect(denied.status).toBe(429)
        expect(Number(retryAfter)).toBeGreaterThan(0)
        expect(denied.headers.get('x-ratelimit-limit')).toBe('1')
        expect(denied.headers.get('x-ratelimit-remaining')).toBe('0')
        expect(denied.headers.get('x-ratelimit-reset')).toMatch(/^\d+$/)
        expect(await denied.json()).toEqual({
          success: false,
          message: `Too many requests. Please try again in ${retryAfter} seconds.`,
          retryAfter: Number(retryAfter),
        })
      }
      expect(calls).toBe(1)
    }
    finally {
      await server.stop(true)
    }
  })
}
