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
  route.get('/_hot/body-state', (request: any) => ({ parsed: request._bodyParsed === true }))
  route.get('/_hot/param/{id}', (request: any) => ({ id: request.params.id }))
  route.get('/_hot/helpers/{id}', (request: any) => ({
    id: request.integer('id'),
    token: request.bearerToken(),
  }))
  route.get('/_hot/encoded/{slug}', (request: any) => ({ slug: request.params.slug }))
  route.get('/_hot/query', (request: any) => ({ query: request.query }))

  // `.skipCsrf()` so the body contract can be tested without also asserting the
  // double-submit dance, which has its own tests.
  route.post('/_hot/body', async (request: any) => {
    const bytes = await request.bytes()
    const arrayBuffer = await request.arrayBuffer()
    const blob = await request.blob()
    return {
      jsonBody: request.jsonBody,
      json: await request.json(),
      text: await request.text(),
      raw: await request.rawBody(),
      bytes: new TextDecoder().decode(bytes),
      arrayBuffer: new TextDecoder().decode(arrayBuffer),
      blob: await blob.text(),
      blobType: blob.type,
      cloned: await request.clone().text(),
    }
  }).skipCsrf()

  route.post('/_hot/empty', (request: any) => ({ jsonBody: request.jsonBody })).skipCsrf()

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
  it('keeps a synchronous action on the synchronous response path', async () => {
    const { enhanceRequest, wrapAction } = await import('../src/stacks-router')
    const request = enhanceRequest(new Request('http://localhost/_hot/synchronous-action') as any)
    request.query = {}
    request.params = {}
    const wrapped = wrapAction({ handle: () => ({ ok: true }) } as any, 'hot-path-synchronous-action')

    const answer = wrapped(request)

    expect(answer).toBeInstanceOf(Response)
    expect(await (answer as Response).json()).toEqual({ ok: true })
  })

  it('keeps concurrent async action response metadata isolated', async () => {
    const { enhanceRequest, wrapAction } = await import('../src/stacks-router')
    let resolveFirst: ((value: unknown) => void) | undefined
    let resolveSecond: ((value: unknown) => void) | undefined
    const wrapped = wrapAction({
      handle: (request: Request) => new Promise((resolve) => {
        if (request.url.endsWith('/first'))
          resolveFirst = resolve
        else
          resolveSecond = resolve
      }),
    } as any, 'hot-path-concurrent-async-action')
    const first = enhanceRequest(new Request('http://localhost/first') as any)
    const second = enhanceRequest(new Request('http://localhost/second') as any)
    first._requestId = 'first-request'
    second._requestId = 'second-request'

    const firstAnswer = wrapped(first) as Promise<Response>
    const secondAnswer = wrapped(second) as Promise<Response>
    resolveSecond?.({ request: 'second' })
    resolveFirst?.({ request: 'first' })

    const [firstResponse, secondResponse] = await Promise.all([firstAnswer, secondAnswer])
    expect(firstResponse.headers.get('x-request-id')).toBe('first-request')
    expect(secondResponse.headers.get('x-request-id')).toBe('second-request')
  })

  it('reports serialization errors from fulfilled async actions', async () => {
    const { enhanceRequest, wrapAction } = await import('../src/stacks-router')
    const request = enhanceRequest(new Request('http://localhost/_hot/async-serialization-error') as any)
    const wrapped = wrapAction({ handle: async () => ({ invalid: 1n }) } as any, 'hot-path-async-serialization-error')

    await expect(wrapped(request)).rejects.toThrow()
  })

  it('keeps an exact native GET synchronous with bun-router context and cookies', async () => {
    const [{ createStacksRouter }, { getCurrentRequest }] = await Promise.all([
      import('../src'),
      import('@stacksjs/bun-router'),
    ])
    const direct = createStacksRouter()
    direct.get('/_hot/native-synchronous', (request) => {
      request.cookies.set('theme', 'dark', { path: '/' })
      return { contextMatches: getCurrentRequest() === request }
    })
    const nativeServer = await direct.serve({ port: 0, hostname: '127.0.0.1', nativeRoutes: true })

    try {
      const nativeRoutes = (direct.bunRouter as any)._buildNativeRoutes()
      const answer = nativeRoutes['/_hot/native-synchronous'].GET(new Request('http://localhost/_hot/native-synchronous', {
        headers: { cookie: 'X-CSRF-Token=already-mine' },
      }))

      expect(answer).toBeInstanceOf(Response)
      expect(await (answer as Response).json()).toEqual({ contextMatches: true })
      expect((answer as Response).headers.get('set-cookie') ?? '').toContain('theme=dark')
      expect((answer as Response).headers.get('x-request-id')).toBeTruthy()
    }
    finally {
      nativeServer.stop()
    }
  })

  it('keeps a native parameter GET synchronous with decoded params', async () => {
    const { createStacksRouter } = await import('../src')
    const direct = createStacksRouter()
    direct.get('/_hot/native-param/{slug}', request => ({ slug: request.params.slug }))
    const nativeServer = await direct.serve({ port: 0, hostname: '127.0.0.1', nativeRoutes: true })

    try {
      const live = await fetch(`http://127.0.0.1:${nativeServer.port}/_hot/native-param/caf%C3%A9`, {
        headers: { cookie: 'X-CSRF-Token=already-mine' },
      })
      expect(await live.json()).toEqual({ slug: 'café' })

      const nativeRoutes = (direct.bunRouter as any)._buildNativeRoutes()
      const request = new Request('http://localhost/_hot/native-param/caf%C3%A9', {
        headers: { cookie: 'X-CSRF-Token=already-mine' },
      }) as Request & { params: Record<string, string> }
      Object.defineProperty(request, 'params', { value: { slug: 'café' }, configurable: true })
      const answer = nativeRoutes['/_hot/native-param/:slug'].GET(request)

      expect(answer).toBeInstanceOf(Response)
      expect(await (answer as Response).json()).toEqual({ slug: 'café' })
    }
    finally {
      nativeServer.stop()
    }
  })

  it('keeps a native JSON POST on the Stacks validation and CSRF pipeline', async () => {
    const { createStacksRouter } = await import('../src')
    const direct = createStacksRouter()
    direct.post('/_hot/native-post', request => ({ name: request.get('name') }))
    const nativeServer = await direct.serve({ port: 0, hostname: '127.0.0.1', nativeRoutes: true })
    const token = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'

    try {
      const nativeRoutes = (direct.bunRouter as any)._buildNativeRoutes()
      const pending = nativeRoutes['/_hot/native-post'].POST(new Request('http://localhost/_hot/native-post', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'cookie': `X-CSRF-Token=${token}`,
          'x-csrf-token': token,
        },
        body: JSON.stringify({ name: 'Ada' }),
      }))

      expect(pending).toBeInstanceOf(Promise)
      expect(await (await pending).json()).toEqual({ name: 'Ada' })
    }
    finally {
      nativeServer.stop()
    }
  })

  it('keeps native GETs with global middleware on the generic dispatcher', async () => {
    const { createStacksRouter } = await import('../src')
    const direct = createStacksRouter()
    direct.use(async (_request, next) => {
      const response = await next()
      response.headers.set('x-global-middleware', 'applied')
      return response
    })
    direct.get('/_hot/native-middleware', () => ({ ok: true }))
    const nativeServer = await direct.serve({ port: 0, hostname: '127.0.0.1', nativeRoutes: true })

    try {
      const nativeRoutes = (direct.bunRouter as any)._buildNativeRoutes()
      const pending = nativeRoutes['/_hot/native-middleware'].GET(new Request('http://localhost/_hot/native-middleware'))

      expect(pending).toBeInstanceOf(Promise)
      expect((await pending).headers.get('x-global-middleware')).toBe('applied')
    }
    finally {
      nativeServer.stop()
    }
  })

  it('keeps first-registration semantics on duplicate native GETs', async () => {
    const { createStacksRouter } = await import('../src')
    const direct = createStacksRouter()
    direct.get('/_hot/native-duplicate', () => ({ registration: 'first' }))
    direct.get('/_hot/native-duplicate', () => ({ registration: 'second' }))
    const nativeServer = await direct.serve({ port: 0, hostname: '127.0.0.1', nativeRoutes: true })

    try {
      const nativeRoutes = (direct.bunRouter as any)._buildNativeRoutes()
      const answer = nativeRoutes['/_hot/native-duplicate'].GET(new Request('http://localhost/_hot/native-duplicate', {
        headers: { cookie: 'X-CSRF-Token=already-mine' },
      }))

      expect(answer).toBeInstanceOf(Response)
      expect(await (answer as Response).json()).toEqual({ registration: 'first' })
    }
    finally {
      nativeServer.stop()
    }
  })

  it('preserves native error handling for a rejected synchronous GET', async () => {
    const { createStacksRouter } = await import('../src')
    const direct = createStacksRouter()
    direct.get('/_hot/native-error', () => {
      throw new Error('native failure')
    })
    direct.bunRouter.onError(error => Response.json({ caught: error.message }, { status: 418 }))
    const nativeServer = await direct.serve({ port: 0, hostname: '127.0.0.1', nativeRoutes: true })

    try {
      const nativeRoutes = (direct.bunRouter as any)._buildNativeRoutes()
      const answer = await nativeRoutes['/_hot/native-error'].GET(new Request('http://localhost/_hot/native-error'))

      expect(answer.status).toBe(418)
      expect(await answer.json()).toEqual({ caught: 'native failure' })
    }
    finally {
      nativeServer.stop()
    }
  })

  it('preserves asynchronous native error handling on the fused response path', async () => {
    const { createStacksRouter } = await import('../src')
    const direct = createStacksRouter()
    direct.get('/_hot/native-async-error', async () => {
      await Promise.resolve()
      throw new Error('async native failure')
    })
    direct.bunRouter.onError(async error => Response.json({ caught: error.message }, { status: 418 }))
    const nativeServer = await direct.serve({ port: 0, hostname: '127.0.0.1', nativeRoutes: true })

    try {
      const nativeRoutes = (direct.bunRouter as any)._buildNativeRoutes()
      const answer = await nativeRoutes['/_hot/native-async-error'].GET(new Request('http://localhost/_hot/native-async-error'))

      expect(answer.status).toBe(418)
      expect(await answer.json()).toEqual({ caught: 'async native failure' })
    }
    finally {
      nativeServer.stop()
    }
  })

  it('still seeds CSRF when the underlying router is called directly', async () => {
    const { createStacksRouter } = await import('../src')
    const direct = createStacksRouter()
    direct.get('/_hot/direct', request => ({ minted: Boolean(request._csrfToken) }))

    const answer = await direct.bunRouter.handleRequest(new Request('http://localhost/_hot/direct'))

    expect(await answer.json()).toEqual({ minted: false })
    expect(answer.headers.get('set-cookie') ?? '').toContain('X-CSRF-Token=')
  })

  it('mints a CSRF token before a browser document renders', async () => {
    const { createStacksRouter } = await import('../src')
    const direct = createStacksRouter()
    direct.get('/_hot/direct-document', request => ({ token: request._csrfToken ?? null }))

    const answer = await direct.bunRouter.handleRequest(new Request('http://localhost/_hot/direct-document', {
      headers: { accept: 'text/html,application/xhtml+xml' },
    }))
    const body = await answer.json() as { token: string }

    expect(body.token).toHaveLength(64)
    expect(answer.headers.get('set-cookie') ?? '').toContain(`X-CSRF-Token=${body.token}`)
  })

  it('distinguishes native API and browser CSRF timing', async () => {
    const { createStacksRouter } = await import('../src')
    const direct = createStacksRouter()
    direct.get('/_hot/native-api-csrf', request => ({ minted: Boolean(request._csrfToken) }))
    direct.get('/_hot/native-document-csrf', async request => ({ token: request._csrfToken ?? null }))
    const nativeServer = await direct.serve({ port: 0, hostname: '127.0.0.1', nativeRoutes: true })

    try {
      const nativeRoutes = (direct.bunRouter as any)._buildNativeRoutes()
      const answer = await nativeRoutes['/_hot/native-api-csrf'].GET(new Request('http://localhost/_hot/native-api-csrf'))
      const documentAnswer = await nativeRoutes['/_hot/native-document-csrf'].GET(new Request('http://localhost/_hot/native-document-csrf', {
        headers: { 'sec-fetch-dest': 'document' },
      }))
      const documentBody = await documentAnswer.json() as { token: string }

      expect(await answer.json()).toEqual({ minted: false })
      expect(answer.headers.get('set-cookie') ?? '').toContain('X-CSRF-Token=')
      expect(documentBody.token).toHaveLength(64)
      expect(documentAnswer.headers.get('set-cookie') ?? '').toContain(`X-CSRF-Token=${documentBody.token}`)
    }
    finally {
      nativeServer.stop()
    }
  })

  it('does not mint a render token for an OPTIONS route', async () => {
    const { createStacksRouter } = await import('../src')
    const direct = createStacksRouter()
    direct.options('/_hot/direct-options', request => ({ minted: Boolean(request._csrfToken) }))

    const answer = await direct.bunRouter.handleRequest(new Request('http://localhost/_hot/direct-options', { method: 'OPTIONS' }))

    expect(await answer.json()).toEqual({ minted: false })
  })

  it('initializes request ids on warm direct dispatches', async () => {
    const { createStacksRouter } = await import('../src')
    const direct = createStacksRouter()
    direct.get('/_hot/direct-id', () => ({ ok: true }))

    const first = await direct.bunRouter.handleRequest(new Request('http://localhost/_hot/direct-id'))
    const second = await direct.bunRouter.handleRequest(new Request('http://localhost/_hot/direct-id'))

    expect(first.headers.get('x-request-id')).toBeTruthy()
    expect(second.headers.get('x-request-id')).toBeTruthy()
    expect(second.headers.get('x-request-id')).not.toBe(first.headers.get('x-request-id'))
  })

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

  it('does not enter the body parser for a GET route', async () => {
    expect(await (await get('/_hot/body-state')).json()).toEqual({ parsed: false })
  })

  it('leaves an empty query as an empty object rather than undefined', async () => {
    expect(await (await get('/_hot/query')).json()).toEqual({ query: {} })
  })

  it('parses a query string without a full URL parse', async () => {
    expect(await (await get('/_hot/query?a=1&b=two')).json()).toEqual({ query: { a: '1', b: 'two' } })
  })

  /*
   * `query` comes from the router now, and a repeated key collects into an
   * array - what `EnhancedRequest` has always declared. The fallback that used
   * to live in `enhanceRequest` kept only the last value, so the shape depended
   * on which layer filled it in.
   */
  it('collects a repeated key into an array', async () => {
    expect(await (await get('/_hot/query?a=1&a=2')).json()).toEqual({ query: { a: ['1', '2'] } })
  })

  it('keeps a plain path param verbatim', async () => {
    expect(await (await get('/_hot/param/42')).json()).toEqual({ id: '42' })
  })

  it('keeps Bun and Stacks helpers on the fused request prototype', async () => {
    const first = await get('/_hot/helpers/41', { headers: { authorization: 'Bearer first' } })
    const second = await get('/_hot/helpers/42', { headers: { authorization: 'Bearer second' } })

    expect(await first.json()).toEqual({ id: 41, token: 'first' })
    expect(await second.json()).toEqual({ id: 42, token: 'second' })
  })

  it('still percent-decodes a param that needs it', async () => {
    expect(await (await get('/_hot/encoded/hello%20world')).json()).toEqual({ slug: 'hello world' })
  })

  it('leaves a malformed percent-escape as-is instead of throwing', async () => {
    expect(await (await get('/_hot/encoded/100%25')).json()).toEqual({ slug: '100%' })
    expect(await (await get('/_hot/encoded/broken%ZZ')).json()).toEqual({ slug: 'broken%ZZ' })
  })

  /*
   * Decoding moved into bun-router (0.1.6), where the param is assigned, and
   * came OUT of `enhanceRequest`. Two layers each calling `decodeURIComponent`
   * would turn `%2520` into a space, and a double decode is how a filter that
   * rejects `../` gets walked past.
   */
  it('decodes exactly once, so a double-encoded sequence stays encoded', async () => {
    expect(await (await get('/_hot/encoded/%2520')).json()).toEqual({ slug: '%20' })
    expect(await (await get('/_hot/encoded/%252e%252e%252f')).json()).toEqual({ slug: '%2e%2e%2f' })
  })
})

/**
 * The body is read once now, not cloned. Everything that used to reach for the
 * un-consumed stream has to keep working, or a webhook signature check quietly
 * starts failing in production and nothing in a test suite notices.
 */
describe('a JSON body stays readable after the router has parsed it', () => {
  const body = JSON.stringify({ name: 'ada', nested: { n: 1 } })

  async function post(path: string, payload: string): Promise<Response> {
    return fetch(`http://127.0.0.1:${port}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: payload,
    })
  }

  it('gives every reader the same bytes', async () => {
    const answer = await (await post('/_hot/body', body)).json() as Record<string, unknown>

    expect(answer.jsonBody).toEqual({ name: 'ada', nested: { n: 1 } })
    expect(answer.json).toEqual({ name: 'ada', nested: { n: 1 } })
    expect(answer.text).toBe(body)
    // Byte-identical, which is the whole point: a re-serialized body fails an
    // HMAC check that the original passes.
    expect(answer.raw).toBe(body)
    expect(answer.bytes).toBe(body)
    expect(answer.arrayBuffer).toBe(body)
    expect(answer.blob).toBe(body)
    expect(answer.blobType).toBe('application/json;charset=utf-8')
    expect(answer.cloned).toBe(body)
  })

  it('lands an empty body as an empty object', async () => {
    expect(await (await post('/_hot/empty', '')).json()).toEqual({ jsonBody: {} })
  })

  it('still rejects malformed JSON with a 400 rather than an empty object', async () => {
    const answer = await post('/_hot/empty', '{"truncated":')

    expect(answer.status).toBe(400)
  })
})
