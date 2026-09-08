import { describe, expect, test } from 'bun:test'
import { applyCompression } from '../../../defaults/app/Middleware/Compress'
import { createStacksRouter } from '../src/stacks-router'

const request = () => new Request('http://localhost/small', { headers: { accept: 'application/json', 'accept-encoding': 'gzip' } })

describe('compression with a known byte upper bound', () => {
  test('a proven small response retains its original unconsumed body and metadata', async () => {
    const body = 'é😀漢字'
    const response = new Response(body, { status: 201, headers: { 'content-type': 'text/plain', 'x-custom': 'kept' } })
    const result = await applyCompression(request(), response, new TextEncoder().encode(body).byteLength)
    expect(result).toBe(response)
    expect(response.bodyUsed).toBe(false)
    expect(result.status).toBe(201)
    expect(result.headers.get('x-custom')).toBe('kept')
    expect(result.headers.get('content-encoding')).toBeNull()
    expect(await result.text()).toBe(body)
  })

  test.each([1023, 1024, 1025])('retains the compression threshold at %i bytes', async (length) => {
    const body = 'x'.repeat(length)
    const response = new Response(body, { headers: { 'content-type': 'text/plain' } })
    const result = await applyCompression(request(), response, length)
    if (length < 1024) {
      expect(result).toBe(response)
      expect(await result.text()).toBe(body)
    }
    else {
      expect(result.headers.get('content-encoding')).toBe('gzip')
      expect(new TextDecoder().decode(Bun.gunzipSync(await result.bytes()))).toBe(body)
    }
  })

  test.each([undefined, -1, 0.5, Number.NaN, Number.POSITIVE_INFINITY])('an absent or invalid bound %s retains real size detection', async (bound) => {
    const body = '漢'.repeat(400)
    const response = new Response(body, { headers: { 'content-type': 'text/plain', 'content-length': '1' } })
    const result = await applyCompression(request(), response, bound)
    expect(result.headers.get('content-encoding')).toBe('gzip')
    expect(new TextDecoder().decode(Bun.gunzipSync(await result.bytes()))).toBe(body)
  })

  test('framework JSON respects UTF-8 bytes and leaves unknown Response sizes to the compressor', async () => {
    const router = createStacksRouter({ autoDiscoverRoutes: false })
    const small = { value: 'é😀漢字' }
    const large = { value: '漢'.repeat(400) }
    router.get('/small', () => small).middleware('compress')
    router.get('/large', () => large).middleware('compress')
    router.get('/unknown', () => new Response(JSON.stringify(large), { headers: { 'content-type': 'application/json', 'content-length': '1' } })).middleware('compress')
    for (const [path, payload, compressed] of [['/small', small, false], ['/large', large, true], ['/unknown', large, true]] as const) {
      const response = await router.handleRequest(new Request(`http://localhost${path}`, { headers: request().headers }))
      expect(response.headers.get('content-encoding')).toBe(compressed ? 'gzip' : null)
      const bytes = await response.bytes()
      expect(JSON.parse(new TextDecoder().decode(compressed ? Bun.gunzipSync(bytes) : bytes))).toEqual(payload)
    }
  })
  test('native serving preserves small Unicode JSON and its response metadata', async () => {
    const router = createStacksRouter({ autoDiscoverRoutes: false })
    const payload = { value: 'é😀漢字' }
    router.get('/native-small', () => payload).middleware('compress')
    const server = await router.serve({ port: 0, nativeRoutes: true })
    try {
      const response = await fetch(`http://localhost:${server.port}/native-small`, {
        headers: { 'accept-encoding': 'gzip', 'x-request-id': 'small-compression-test' },
      })
      expect(response.headers.get('content-encoding')).toBeNull()
      expect(response.headers.get('x-request-id')).toBe('small-compression-test')
      expect(response.headers.get('x-content-type-options')).toBe('nosniff')
      const bytes = await response.bytes()
      expect(Number(response.headers.get('content-length'))).toBe(bytes.byteLength)
      expect(JSON.parse(new TextDecoder().decode(bytes))).toEqual(payload)
    }
    finally {
      await server.stop(true)
    }
  })

})
