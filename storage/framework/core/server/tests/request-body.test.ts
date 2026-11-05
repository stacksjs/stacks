import { describe, expect, it } from 'bun:test'
import { serverRequestBodyOptions } from '../src/request-body'

describe('HTTP request-body configuration', () => {
  it('keeps the runtime default when no limit is configured', () => {
    expect(serverRequestBodyOptions(undefined)).toEqual({})
  })

  it('refuses invalid or unbounded listener budgets', () => {
    for (const value of [null, '320MB', 0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])
      expect(() => serverRequestBodyOptions(value)).toThrow('positive safe integer')
  })

  it('enforces the configured ceiling on a real HTTP socket', async () => {
    const server = Bun.serve({
      port: 0,
      ...serverRequestBodyOptions(1024),
      async fetch(request) { return new Response(String((await request.arrayBuffer()).byteLength)) },
    })
    try {
      const small = await fetch(server.url, { method: 'POST', body: 'x'.repeat(512) })
      expect(small.status).toBe(200)
      expect(await small.text()).toBe('512')
      const large = await fetch(server.url, { method: 'POST', body: 'x'.repeat(2048) })
      expect(large.status).toBe(413)
      await large.body?.cancel()
    }
    finally { await server.stop(true) }
  })
})
