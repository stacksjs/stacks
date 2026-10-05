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
        forwardedFor: req.headers.get('x-forwarded-for'),
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

  test('appends the socket peer it saw to X-Forwarded-For', async () => {
    // The backend trusts this hop (loopback), so the last entry is the one it
    // believes. Forwarded untouched, a client reaching the views port directly
    // wrote that entry itself.
    const { registerPeerSource } = await import('@stacksjs/bun-router')
    const { proxyToBackend } = await import('../src/proxy')
    const front = Bun.serve({
      port: 0,
      hostname: '127.0.0.1',
      fetch(req, server) {
        registerPeerSource(server)
        const url = new URL(req.url)
        // A rewrite proxies a copy, which has no socket of its own.
        if (url.pathname === '/rewritten')
          return proxyToBackend(new Request(new URL('/api/target', url), req), base, undefined, req)
        return proxyToBackend(req, base)
      },
    })
    try {
      const via = async (path: string, headers: Record<string, string> = {}) =>
        (await (await fetch(`http://127.0.0.1:${front.port}${path}`, { headers })).json() as any).forwardedFor

      expect(await via('/api/ping', { 'x-forwarded-for': '198.51.100.1' })).toBe('198.51.100.1, 127.0.0.1')
      expect(await via('/api/ping')).toBe('127.0.0.1')
      expect(await via('/rewritten', { 'x-forwarded-for': '198.51.100.1' })).toBe('198.51.100.1, 127.0.0.1')
    }
    finally {
      front.stop(true)
    }
  })

  test('viewClientAddress resolves a view\'s ip from the peer, not a client-written prefix', async () => {
    const { viewClientAddress } = await import('../src/proxy')
    const views = Bun.serve({
      port: 0,
      hostname: '127.0.0.1',
      fetch: (req, server) => new Response(viewClientAddress(req, server) ?? ''),
    })
    try {
      const ip = async (headers: Record<string, string> = {}) =>
        (await fetch(`http://127.0.0.1:${views.port}/`, { headers })).text()

      expect(await ip()).toBe('127.0.0.1')
      // Loopback is the gateway, so the hop it appended counts and the prefix does not.
      expect(await ip({ 'x-forwarded-for': '198.51.100.1, 203.0.113.7' })).toBe('203.0.113.7')
    }
    finally {
      views.stop(true)
    }
  })

  test('leaves X-Forwarded-For alone when there is no socket peer', async () => {
    const { proxyToBackend } = await import('../src/proxy')
    const req = new Request('http://frontend.test/api/ping', { headers: { 'x-forwarded-for': '203.0.113.7' } })
    const echo = await (await proxyToBackend(req, base)).json() as any
    expect(echo.forwardedFor).toBe('203.0.113.7')
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
