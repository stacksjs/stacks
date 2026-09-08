import { expect, test } from 'bun:test'
import type { EnhancedRequest } from '@stacksjs/bun-router'
import { createStacksRouter, enhanceRequest } from '../src/stacks-router'

test('unparsed arrayBuffer reads retain native body consumption', async () => {
  const body = 'Unparsed é😀漢字'
  const request = enhanceRequest(new Request('http://localhost/', { method: 'POST', body }) as EnhancedRequest)
  expect(new TextDecoder().decode(await request.arrayBuffer())).toBe(body)
  expect(request.bodyUsed).toBe(true)
  await expect(request.arrayBuffer()).rejects.toThrow()
})

for (const nativeRoutes of [false, true]) {
  test(`replayed array buffers remain independently owned over HTTP (nativeRoutes=${nativeRoutes})`, async () => {
    const router = createStacksRouter({ autoDiscoverRoutes: false })
    router.post('/replay-buffer', async (request) => {
      const original = await request.text()
      const first = await request.arrayBuffer()
      const second = await request.arrayBuffer()
      expect(first).not.toBe(second)
      expect(new TextDecoder().decode(first)).toBe(original)
      expect(new TextDecoder().decode(second)).toBe(original)
      new Uint8Array(first).fill(0)
      expect(new TextDecoder().decode(second)).toBe(original)
      const transferred = structuredClone(second, { transfer: [second] })
      expect(second.byteLength).toBe(0)
      expect(new TextDecoder().decode(transferred)).toBe(original)
      const third = await request.arrayBuffer()
      expect(new TextDecoder().decode(third)).toBe(original)
      expect(await request.text()).toBe(original)
      return { bytes: third.byteLength, body: new TextDecoder().decode(third) }
    }).skipCsrf()
    const server = await router.serve({ port: 0, nativeRoutes })
    try {
      const bodies = Array.from({ length: 6 }, (_, id) => JSON.stringify({ id, value: 'é😀漢字'.repeat(id * 100 + 1) }))
      await Promise.all(bodies.map(async (body, id) => {
        const response = await fetch(`http://localhost:${server.port}/replay-buffer`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-request-id': `buffer-${id}`, 'accept-encoding': 'identity' },
          body,
        })
        expect(response.status).toBe(200)
        expect(response.headers.get('x-request-id')).toBe(`buffer-${id}`)
        expect(response.headers.get('x-content-type-options')).toBe('nosniff')
        expect(await response.json()).toEqual({ bytes: new TextEncoder().encode(body).byteLength, body })
      }))
    }
    finally {
      await server.stop(true)
    }
  })
}
