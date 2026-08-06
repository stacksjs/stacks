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

  /**
   * Bearer token minted for `actingUser`, cached for the life of the client so
   * a multi-request test does not create a personal access token per call.
   */
  let actingToken: string | null = null

  /**
   * Authenticate as `actingUser` by minting a REAL token.
   *
   * This used to attach an `X-Test-Acting-User` sentinel header and claim "the
   * auth middleware checks it when APP_ENV === 'test'". No middleware has ever
   * read that header — the string existed only here, in the package that wrote
   * it — so `actingAs()` was a no-op and every feature test against an
   * `auth`-guarded route got a 401 (stacksjs/stacks#2228).
   *
   * The fix is not to teach the middleware the sentinel. A header that
   * authenticates as an arbitrary user whenever an env var is set is a
   * production auth bypass one misconfiguration away, and it would also mean
   * feature tests exercise a code path that only exists for tests. Minting a
   * token through `Auth.loginUsingId()` sends the request through the same
   * bearer-token path a real client uses, so the test actually covers the
   * middleware it is meant to cover.
   *
   * Imported lazily: a test that never calls `actingAs()` should not pay for
   * booting auth and the ORM.
   */
  async function resolveActingToken(): Promise<string | null> {
    if (!actingUser) return null
    if (actingToken) return actingToken

    const { Auth } = await import('@stacksjs/auth')
    const id = Number(actingUser.id)
    if (!Number.isFinite(id))
      throw new TypeError(`actingAs() needs a user with a numeric id; got ${JSON.stringify(actingUser.id)}`)

    const session = await Auth.loginUsingId(id)
    if (!session) {
      throw new Error(
        `actingAs() could not authenticate user ${id}: no such user. `
        + `Create the row first (e.g. via a factory) so a token can be issued against it.`,
      )
    }

    actingToken = String(session.token)
    return actingToken
  }

  async function buildHeaders(body?: unknown): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      ...extraHeaders,
    }
    if (body !== undefined) headers['Content-Type'] = 'application/json'

    const token = await resolveActingToken()
    // An explicit `withHeaders({ Authorization })` wins: a test that sets its
    // own token is deliberately exercising that token, not the acting user's.
    if (token && !headers.Authorization && !headers.authorization)
      headers.Authorization = `Bearer ${token}`

    return headers
  }

  async function send(method: string, path: string, body?: unknown): Promise<FeatureTestResponse> {
    const handler = await resolveServer()
    const url = path.startsWith('http') ? path : `${baseUrl}${path}`
    const init: RequestInit = {
      method,
      headers: await buildHeaders(body),
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    }
    const res = await handler(new Request(url, init))
    return buildResponse(res)
  }

  const client: FeatureTestClient = {
    actingAs(user) {
      actingUser = user
      // Drop any token minted for a previous user, or a second
      // `actingAs()` in the same test would keep sending the first one's.
      actingToken = null
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
