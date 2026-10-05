import { expect, test } from 'bun:test'
import Throttle from '../../../defaults/app/Middleware/Throttle'
import { Middleware } from '../src/middleware'
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

/*
 * Whose budget a request spends (the per-user/per-client keying). Before this,
 * bun-router's default key read `request.user.id` - the async `user()`
 * accessor on a Stacks request, so never a user - and then the FIRST
 * X-Forwarded-For entry, which a client writes itself.
 */
for (const nativeRoutes of [false, true]) {
  test(`throttle keys signed-in requests on the user and reports the budget on success (nativeRoutes=${nativeRoutes})`, async () => {
    const router = createStacksRouter({ autoDiscoverRoutes: false })
    // Stands in for the Auth middleware, which stamps `_authenticatedUser`.
    router.use(new Middleware({
      name: 'test-user',
      priority: 1,
      handle(request) {
        const id = request.headers.get('x-test-user')
        if (id)
          request._authenticatedUser = { id: Number(id) }
      },
    }))
    const path = `/user-throttle-${nativeRoutes}`
    router.get(path, () => ({ ok: true })).middleware(`throttle:2,${nativeRoutes ? 74 : 73}`)
    const server = await router.serve({ port: 0, hostname: '127.0.0.1', nativeRoutes })

    try {
      const url = `http://127.0.0.1:${server.port}${path}`
      const as = (user: number) => fetch(url, { headers: { 'x-test-user': String(user) } })

      const first = await as(1)
      expect(first.status).toBe(200)
      expect(first.headers.get('x-ratelimit-limit')).toBe('2')
      expect(first.headers.get('x-ratelimit-remaining')).toBe('1')
      expect(first.headers.get('x-ratelimit-reset')).toMatch(/^\d+$/)
      expect((await as(1)).headers.get('x-ratelimit-remaining')).toBe('0')
      expect((await as(1)).status).toBe(429)

      // Same address, different user: a budget of its own.
      const other = await as(2)
      expect(other.status).toBe(200)
      expect(other.headers.get('x-ratelimit-remaining')).toBe('1')
    }
    finally {
      await server.stop(true)
    }
  })
}

test('throttle runs after auth, so the user is known when it keys', () => {
  expect(Throttle.priority).toBeGreaterThan(1)
})

test('an anonymous client cannot reset its budget by writing X-Forwarded-For', async () => {
  const router = createStacksRouter({ autoDiscoverRoutes: false })
  const path = '/anonymous-throttle'
  router.get(path, () => ({ ok: true })).middleware('throttle:2,75')
  const server = await router.serve({ port: 0, hostname: '127.0.0.1' })

  try {
    const url = `http://127.0.0.1:${server.port}${path}`
    const statuses: number[] = []
    for (let i = 0; i < 3; i++) {
      // A loopback peer is a trusted proxy, so its nearest hop is the client;
      // what the client prepended to the chain is not.
      const res = await fetch(url, { headers: { 'x-forwarded-for': `198.18.0.${i}, 203.0.113.9` } })
      statuses.push(res.status)
    }
    expect(statuses).toEqual([200, 200, 429])

    // A different client behind the same proxy is unaffected.
    expect((await fetch(url, { headers: { 'x-forwarded-for': '203.0.113.10' } })).status).toBe(200)
  }
  finally {
    await server.stop(true)
  }
})
