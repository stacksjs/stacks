import { expect, test } from 'bun:test'
import { brotliDecompressSync } from 'node:zlib'
import { applyCompression } from '../../../defaults/app/Middleware/Compress'

test('retained compressed responses own the correct byte range after later requests and GC', async () => {
  const retained: { response: Response, payload: string, encoding: string }[] = []
  for (const encoding of ['gzip', 'br']) {
    for (const length of [1024, 1025, 2047, 8191, 16385]) {
      const payload = JSON.stringify({ encoding, length, value: 'é😀漢字'.repeat(length) })
      const response = await applyCompression(
        new Request('http://localhost/compress', { headers: { 'accept-encoding': encoding } }),
        new Response(payload, {
          status: 201,
          statusText: 'Created',
          headers: {
            'content-type': 'application/json',
            'x-request-id': `${encoding}-${length}`,
            'x-content-type-options': 'nosniff',
            'set-cookie': `request=${encoding}-${length}; HttpOnly`,
            vary: 'Origin',
          },
        }),
      )
      retained.push({ response, payload, encoding })
    }
  }

  // Later codec calls and collection must not overwrite or release the bytes
  // backing responses that the transport has not consumed yet.
  Bun.gc(true)
  for (const { response, payload, encoding } of retained.toReversed()) {
    const bytes = await response.bytes()
    const decoded = encoding === 'gzip' ? Bun.gunzipSync(bytes) : brotliDecompressSync(bytes)
    expect(new TextDecoder().decode(decoded)).toBe(payload)
    expect(response.status).toBe(201)
    expect(response.statusText).toBe('Created')
    expect(response.headers.get('content-encoding')).toBe(encoding)
    expect(response.headers.get('content-length')).toBe(String(bytes.byteLength))
    expect(response.headers.get('content-type')).toBe('application/json')
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect(response.headers.get('x-request-id')).toBe(`${encoding}-${JSON.parse(payload).length}`)
    expect(response.headers.get('set-cookie')).toBe(`request=${encoding}-${JSON.parse(payload).length}; HttpOnly`)
    expect(response.headers.get('vary')).toBe('Origin, Accept-Encoding')
  }
})
