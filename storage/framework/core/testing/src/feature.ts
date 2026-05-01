import process from 'node:process'

export function setupTestEnvironment(): void {
  process.env.NODE_ENV = 'test'
  process.env.APP_ENV = 'test'
}

/**
 * Lightweight feature-test helper. Returns a fluent client that wraps
 * the request flow (`actingAs`, `json`, `assertStatus`, etc.) so test
 * files don't have to re-implement boilerplate around `serverResponse`.
 *
 * Tests that need raw `fetch`-style access can still call the underlying
 * server entrypoint directly — the helper is purely additive.
 *
 * @example
 * ```ts
 * import { featureTest, refreshDatabase } from '@stacksjs/testing'
 *
 * test('create post', async () => {
 *   await refreshDatabase()
 *   const user = await User.create({ email: 'a@b.com' })
 *
 *   const res = await featureTest()
 *     .actingAs(user)
 *     .post('/api/posts', { title: 'hello' })
 *
 *   res.assertStatus(201)
 *   const body = await res.json<{ id: number, title: string }>()
 *   expect(body.title).toBe('hello')
 * })
 * ```
 */
export interface FeatureTestResponse {
  status: number
  headers: Headers
  text: () => Promise<string>
  json: <T = unknown>() => Promise<T>
  assertStatus: (expected: number) => FeatureTestResponse
  assertJson: <T extends Record<string, unknown>>(partial: T) => Promise<FeatureTestResponse>
  assertHeader: (name: string, expected?: string | RegExp) => FeatureTestResponse
}

export interface FeatureTestClient {
  actingAs: (user: { id: number | string, [k: string]: unknown }) => FeatureTestClient
  withHeaders: (headers: Record<string, string>) => FeatureTestClient
  get: (path: string) => Promise<FeatureTestResponse>
  post: (path: string, body?: unknown) => Promise<FeatureTestResponse>
  put: (path: string, body?: unknown) => Promise<FeatureTestResponse>
  patch: (path: string, body?: unknown) => Promise<FeatureTestResponse>
  delete: (path: string, body?: unknown) => Promise<FeatureTestResponse>
}

/**
 * Resolve the in-process request handler. We deliberately import lazily
 * so tests that don't make HTTP calls don't pay the router boot cost.
 */
async function resolveServer(): Promise<(req: Request) => Promise<Response>> {
  const router = await import('@stacksjs/router')
  // serverResponse handles the full pipeline incl. lazy route loading.
  // eslint-disable-next-line pickier/no-unused-vars
  return router.serverResponse as unknown as (req: Request) => Promise<Response>
}

function buildResponse(res: Response): FeatureTestResponse {
  const wrapper: FeatureTestResponse = {
    status: res.status,
    headers: res.headers,
    text: () => res.text(),
    json: async <T = unknown>() => (await res.clone().json()) as T,
    assertStatus(expected) {
      if (this.status !== expected) {
        throw new Error(`Expected status ${expected}, got ${this.status}`)
      }
      return wrapper
    },
    async assertJson(partial) {
      const body = await res.clone().json() as Record<string, unknown>
      for (const [k, v] of Object.entries(partial)) {
        if (JSON.stringify(body[k]) !== JSON.stringify(v)) {
          throw new Error(`assertJson: expected ${k}=${JSON.stringify(v)}, got ${JSON.stringify(body[k])}`)
        }
      }
      return wrapper
    },
    assertHeader(name, expected) {
      const value = res.headers.get(name)
      if (value === null) throw new Error(`assertHeader: missing header '${name}'`)
      if (expected !== undefined) {
        const ok = typeof expected === 'string' ? value === expected : expected.test(value)
        if (!ok) throw new Error(`assertHeader: expected ${name}=${String(expected)}, got '${value}'`)
      }
      return wrapper
    },
  }
  return wrapper
}

export function featureTest(baseUrl: string = 'http://localhost'): FeatureTestClient {
  let actingUser: { id: number | string, [k: string]: unknown } | null = null
  let extraHeaders: Record<string, string> = {}

  function buildHeaders(body?: unknown): Record<string, string> {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      ...extraHeaders,
    }
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    if (actingUser) {
      // Stacks ships token-based auth — tests use a dev token, but the
      // simpler path here is to expose the user via a sentinel header
      // the auth middleware understands in test mode. The auth middleware
      // checks `X-Test-Acting-User` only when APP_ENV === 'test'.
      headers['X-Test-Acting-User'] = JSON.stringify(actingUser)
    }
    return headers
  }

  async function send(method: string, path: string, body?: unknown): Promise<FeatureTestResponse> {
    const handler = await resolveServer()
    const url = path.startsWith('http') ? path : `${baseUrl}${path}`
    const init: RequestInit = {
      method,
      headers: buildHeaders(body),
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    }
    const res = await handler(new Request(url, init))
    return buildResponse(res)
  }

  const client: FeatureTestClient = {
    actingAs(user) {
      actingUser = user
      return client
    },
    withHeaders(headers) {
      extraHeaders = { ...extraHeaders, ...headers }
      return client
    },
    get: path => send('GET', path),
    post: (path, body) => send('POST', path, body),
    put: (path, body) => send('PUT', path, body),
    patch: (path, body) => send('PATCH', path, body),
    delete: (path, body) => send('DELETE', path, body),
  }
  return client
}
