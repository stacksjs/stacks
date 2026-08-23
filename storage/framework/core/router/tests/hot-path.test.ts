/**
 * What the per-request path is allowed to do, driven through a real server.
 *
 * The router's cross-cutting defaults - CSRF seeding, security headers,
 * request-id, Server-Timing - were correct and were being re-derived from
 * scratch on every request: three synchronous `existsSync` stats and three
 * dynamic `import()`s per GET, plus a params object and a full `new URL()`
 * parse for routes that had neither params nor a query string.
 *
 * These lock the behaviour that had to survive the fix. The throughput half of
 * the claim lives in `bench/routing/`, because a test that asserts a number of
 * requests per second is a test that fails on somebody else's laptop.
 */

import { afterAll, beforeAll, describe, expect, it } from 'bun:test'

let server: any = null
let port = 0

beforeAll(async () => {
  const { route } = await import('../src')

  route.get('/_hot/plain', () => ({ ok: true }))
  route.get('/_hot/param/{id}', (request: any) => ({ id: request.params.id }))
  route.get('/_hot/encoded/{slug}', (request: any) => ({ slug: request.params.slug }))
  route.get('/_hot/query', (request: any) => ({ query: request.query }))

  server = await route.serve({ port: 0, hostname: '127.0.0.1' })
  port = Number(server?.port ?? server?.server?.port ?? 0)
})

afterAll(() => {
  server?.stop?.()
})

function get(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`http://127.0.0.1:${port}${path}`, init)
}

describe('the request path keeps its defaults', () => {
  it('still seeds a CSRF cookie on a cold GET', async () => {
    const answer = await get('/_hot/plain')

    expect(answer.headers.get('set-cookie') ?? '').toContain('X-CSRF-Token=')
  })

  it('mints a fresh token per cold request rather than reusing a cached one', async () => {
    // The module reference is cached now; the token must not be.
    const first = (await get('/_hot/plain')).headers.get('set-cookie') ?? ''
    const second = (await get('/_hot/plain')).headers.get('set-cookie') ?? ''

    expect(first).not.toBe('')
    expect(first).not.toBe(second)
  })

  it('leaves a request that already carries a token alone', async () => {
    const answer = await get('/_hot/plain', { headers: { cookie: 'X-CSRF-Token=already-mine' } })

    expect(answer.headers.get('set-cookie') ?? '').toBe('')
  })

  it('still applies the security headers and the request id', async () => {
    const answer = await get('/_hot/plain')

    expect(answer.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(answer.headers.get('X-Frame-Options')).toBe('SAMEORIGIN')
    expect(answer.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
    expect(answer.headers.get('X-Request-ID')).toBeTruthy()
  })

  it('re-resolves the CSRF module after the cache is cleared', async () => {
    const { clearCsrfModuleCache } = await import('../src')
    clearCsrfModuleCache()

    expect((await get('/_hot/plain')).headers.get('set-cookie') ?? '').toContain('X-CSRF-Token=')
  })
})

describe('params and query, only when there are any', () => {
  it('answers a route with no params and no query string', async () => {
    expect(await (await get('/_hot/plain')).json()).toEqual({ ok: true })
  })

  it('leaves an empty query as an empty object rather than undefined', async () => {
    expect(await (await get('/_hot/query')).json()).toEqual({ query: {} })
  })

  it('parses a query string without a full URL parse', async () => {
    expect(await (await get('/_hot/query?a=1&b=two')).json()).toEqual({ query: { a: '1', b: 'two' } })
  })

  it('keeps a plain path param verbatim', async () => {
    expect(await (await get('/_hot/param/42')).json()).toEqual({ id: '42' })
  })

  it('still percent-decodes a param that needs it', async () => {
    expect(await (await get('/_hot/encoded/hello%20world')).json()).toEqual({ slug: 'hello world' })
  })

  it('leaves a malformed percent-escape as-is instead of throwing', async () => {
    expect(await (await get('/_hot/encoded/100%25')).json()).toEqual({ slug: '100%' })
    expect(await (await get('/_hot/encoded/broken%ZZ')).json()).toEqual({ slug: 'broken%ZZ' })
  })
})
