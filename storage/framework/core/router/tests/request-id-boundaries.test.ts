import { expect, test } from 'bun:test'
import { createStacksRouter } from '../src/stacks-router'

for (const nativeRoutes of [false, true]) {
  test(`incoming request IDs retain their bounds and alphabet over HTTP (nativeRoutes=${nativeRoutes})`, async () => {
    const router = createStacksRouter({ autoDiscoverRoutes: false })
    router.get('/request-id-boundaries', request => ({ seen: request._requestId }))
    const server = await router.serve({ port: 0, nativeRoutes })
    const cases = [
      { supplied: 'a'.repeat(7), accepted: false },
      { supplied: 'a'.repeat(8), accepted: true },
      { supplied: 'a'.repeat(200), accepted: true },
      { supplied: 'a'.repeat(201), accepted: false },
      { supplied: 'a'.repeat(199) + '/', accepted: false },
      { supplied: ' 	trace_AZ09.:-	 ', accepted: true },
      { supplied: 'trace with-space', accepted: false },
      { supplied: 'trace-café', accepted: false },
      { supplied: '', accepted: false },
    ]
    try {
      const generated = await Promise.all(cases.map(async ({ supplied, accepted }) => {
        const response = await fetch(`http://localhost:${server.port}/request-id-boundaries`, {
          headers: { 'x-request-id': supplied, 'accept-encoding': 'identity' },
        })
        expect(response.status).toBe(200)
        expect(response.headers.get('x-content-type-options')).toBe('nosniff')
        const id = response.headers.get('x-request-id')
        expect(await response.json()).toEqual({ seen: id })
        if (accepted) {
          expect(id).toBe(supplied.trim())
          return undefined
        }
        expect(id).not.toBe(supplied.trim())
        expect(id).toMatch(/^[0-9a-f]{16}-[0-9a-z]+$/)
        return id
      }))
      const replacements = generated.filter(id => id !== undefined)
      expect(new Set(replacements).size).toBe(replacements.length)
    }
    finally {
      await server.stop(true)
    }
  })
}
