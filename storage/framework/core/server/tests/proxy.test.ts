import { afterAll, beforeAll, describe, expect, test } from 'bun:test'

let upstream: ReturnType<typeof Bun.serve>
let base: string

beforeAll(() => {
  upstream = Bun.serve({
    port: 0,
    async fetch(req) {
      const url = new URL(req.url)

      if (url.pathname === '/redirect')
        return new Response(null, { status: 302, headers: { Location: 'https://example.com/next' } })

      if (url.pathname === '/encoded')
        return new Response('encoded-body', { headers: { 'content-encoding': 'identity', 'x-upstream': 'yes' } })

      const body = req.method === 'GET' || req.method === 'HEAD' ? null : await req.text()
      return Response.json({
        method: req.method,
        path: url.pathname,
        search: url.search,
        body,
        host: req.headers.get('host'),
        forwardedHost: req.headers.get('x-forwarded-host'),
        forwardedProto: req.headers.get('x-forwarded-proto'),
      })
    },
  })
  base = `http://127.0.0.1:${upstream.port}`
})

afterAll(() => {
  upstream.stop(true)
})

describe('isApiBoundRequest', () => {
  test('matches the canonical /api/ prefix', async () => {
    const { isApiBoundRequest } = await import('../src/proxy')
    const req = new Request('http://localhost/api/users')
    expect(isApiBoundRequest(req, '/api/users')).toBe(true)
  })

  test('matches any non-GET/HEAD verb regardless of path', async () => {
    const { isApiBoundRequest } = await import('../src/proxy')
    expect(isApiBoundRequest(new Request('http://localhost/', { method: 'POST' }), '/')).toBe(true)
    expect(isApiBoundRequest(new Request('http://localhost/x', { method: 'PUT' }), '/x')).toBe(true)
    expect(isApiBoundRequest(new Request('http://localhost/x', { method: 'PATCH' }), '/x')).toBe(true)
    expect(isApiBoundRequest(new Request('http://localhost/x', { method: 'DELETE' }), '/x')).toBe(true)
  })

  test('does not match GET/HEAD page requests', async () => {
    const { isApiBoundRequest } = await import('../src/proxy')
    expect(isApiBoundRequest(new Request('http://localhost/'), '/')).toBe(false)
    expect(isApiBoundRequest(new Request('http://localhost/docs', { method: 'HEAD' }), '/docs')).toBe(false)
  })

  test('requires the /api/ prefix, not just /api*', async () => {
    const { isApiBoundRequest } = await import('../src/proxy')
    expect(isApiBoundRequest(new Request('http://localhost/apifoo'), '/apifoo')).toBe(false)
  })
})

describe('proxyToBackend', () => {
  test('forwards method, path, query string and body', async () => {
    const { proxyToBackend } = await import('../src/proxy')
    const req = new Request('http://frontend.test/api/users?page=2', {
      method: 'POST',
      body: JSON.stringify({ name: 'Chris' }),
      headers: { 'content-type': 'application/json' },
    })
    const resp = await proxyToBackend(req, base)
    const echo = await resp.json() as any
    expect(echo.method).toBe('POST')
    expect(echo.path).toBe('/api/users')
    expect(echo.search).toBe('?page=2')
    expect(echo.body).toBe(JSON.stringify({ name: 'Chris' }))
  })

  test('sets x-forwarded-host/proto and drops the inbound host header', async () => {
    const { proxyToBackend } = await import('../src/proxy')
    const req = new Request('http://frontend.test/api/ping', {
      headers: { host: 'frontend.test' },
    })
    const resp = await proxyToBackend(req, base)
    const echo = await resp.json() as any
    expect(echo.forwardedHost).toBe('frontend.test')
    expect(echo.forwardedProto).toBe('http')
    // fetch re-derives host from the upstream target; the original must not leak.
    expect(echo.host).not.toContain('frontend.test')
  })

  test('does not follow upstream redirects', async () => {
    const { proxyToBackend } = await import('../src/proxy')
    const resp = await proxyToBackend(new Request('http://frontend.test/redirect'), base)
    expect(resp.status).toBe(302)
    expect(resp.headers.get('Location')).toBe('https://example.com/next')
  })

  test('strips content-length and content-encoding from upstream responses', async () => {
    const { proxyToBackend } = await import('../src/proxy')
    const resp = await proxyToBackend(new Request('http://frontend.test/encoded'), base)
    expect(resp.headers.get('content-length')).toBeNull()
    expect(resp.headers.get('content-encoding')).toBeNull()
    // Other upstream headers pass through untouched.
    expect(resp.headers.get('x-upstream')).toBe('yes')
    expect(await resp.text()).toBe('encoded-body')
  })

  test('stripPrefix removes the route prefix before forwarding', async () => {
    const { proxyToBackend } = await import('../src/proxy')
    const nested = await proxyToBackend(new Request('http://frontend.test/docs/guide'), base, '/docs')
    expect(((await nested.json()) as any).path).toBe('/guide')

    const bare = await proxyToBackend(new Request('http://frontend.test/docs'), base, '/docs')
    expect(((await bare.json()) as any).path).toBe('/')
  })

  test('rejects when the backend is unreachable (callers return 502)', async () => {
    const { proxyToBackend } = await import('../src/proxy')
    // Port 1 is never bound; connection is refused immediately.
    expect(proxyToBackend(new Request('http://frontend.test/api/users'), 'http://127.0.0.1:1')).rejects.toThrow()
  })
})
