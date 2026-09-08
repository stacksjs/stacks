import { expect, test } from 'bun:test'
import { brotliDecompressSync } from 'node:zlib'
import { applyCompression } from '../../../defaults/app/Middleware/Compress'
import { clearMiddlewareCache, createStacksRouter } from '../src/stacks-router'

const payload = 'Weighted offers preserve the original response bytes. '.repeat(100)
const offers = [
  ['br;q=0, gzip;q=1', 'gzip'],
  ['br;q=0.2, gzip;q=0.8', 'gzip'],
  ['gzip;q=0.2, br;q=0.8', 'br'],
  ['gzip, br', 'br'],
  ['BR;Q=0.250, GZIP; q=0.750', 'gzip'],
  ['br;q=0, *;q=0.8', 'gzip'],
  ['gzip;q=0, *;q=0.8', 'br'],
  ['br;q=bogus, *;q=1', 'gzip'],
  ['br;q=0.0000, gzip', 'gzip'],
  ['br;q=1.001, gzip', 'gzip'],
  ['br;q=0;q=1, gzip', 'gzip'],
  ['br;level=5, gzip', 'gzip'],
  ['br;q=0.2, identity;q=0.8', null],
  ['gzip;q=0, br;q=0', null],
  ['zebra, gzip-extra', null],
  ['', null],
] as const

async function decoded(response: Response): Promise<string> {
  const encoding = response.headers.get('content-encoding')
  const bytes = await response.bytes()
  return new TextDecoder().decode(encoding === 'br' ? brotliDecompressSync(bytes) : encoding === 'gzip' ? Bun.gunzipSync(bytes) : bytes)
}

test('Brotli middleware honors weights and complete tokens on repeated and changing offers', async () => {
  for (const entries of [offers, offers.toReversed()]) {
    for (const [offer, encoding] of entries) {
      for (let repeat = 0; repeat < 2; repeat++) {
        const original = new Response(payload, { status: 201, headers: { 'content-type': 'text/plain', 'x-request-id': 'weighted-offer-test' } })
        const response = await applyCompression(new Request('http://localhost/', { headers: { 'accept-encoding': offer } }), original)
        expect(response.headers.get('content-encoding')).toBe(encoding)
        expect(response.status).toBe(201)
        expect(response.headers.get('x-request-id')).toBe('weighted-offer-test')
        if (encoding === null)
          expect(response).toBe(original)
        expect(await decoded(response)).toBe(payload)
      }
    }
  }
})

for (const nativeRoutes of [false, true]) {
  test(`weighted Brotli/gzip choices reach HTTP clients (nativeRoutes=${nativeRoutes})`, async () => {
    clearMiddlewareCache()
    const router = createStacksRouter({ autoDiscoverRoutes: false })
    router.get('/weighted-compression', () => new Response(payload, { headers: { 'content-type': 'text/plain' } })).middleware('compress')
    const server = await router.serve({ port: 0, nativeRoutes })
    try {
      const encodedOffers = offers.filter(entry => entry[1] !== null)
      const responses = await Promise.all(encodedOffers.map(async ([offer, encoding]) => {
        const response = await fetch(`http://localhost:${server.port}/weighted-compression`, {
          headers: { 'accept-encoding': offer, 'x-request-id': 'weighted-http-test' },
          decompress: false,
        })
        expect(response.status).toBe(200)
        expect(response.headers.get('content-encoding')).toBe(encoding)
        expect(response.headers.get('x-request-id')).toBe('weighted-http-test')
        expect(response.headers.get('x-content-type-options')).toBe('nosniff')
        expect(response.headers.get('vary')).toContain('Accept-Encoding')
        return decoded(response)
      }))
      expect(responses).toEqual(encodedOffers.map(() => payload))
    }
    finally {
      await server.stop(true)
    }
  })
}
