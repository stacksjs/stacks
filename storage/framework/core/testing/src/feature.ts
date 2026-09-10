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
  /** `true` for a 2xx status, matching `Response.ok`. */
  ok: boolean
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
  /**
   * The full request, for anything the verb shorthands cannot express -
   * a query string, a multipart body, or a method they do not cover.
   */
  request: (method: string, path: string, spec?: Omit<RequestOptions, 'actingAs'>) => Promise<FeatureTestResponse>
  get: (path: string) => Promise<FeatureTestResponse>
  post: (path: string, body?: unknown) => Promise<FeatureTestResponse>
  put: (path: string, body?: unknown) => Promise<FeatureTestResponse>
  patch: (path: string, body?: unknown) => Promise<FeatureTestResponse>
  delete: (path: string, body?: unknown) => Promise<FeatureTestResponse>
}

/** A value a query string can carry, before it is stringified. */
export type QueryValue = string | number | boolean | null | undefined | Array<string | number | boolean>

/**
 * One request, described rather than built up by chaining.
 *
 * This is the shape `http.*` takes. It exists next to the fluent client
 * because the two answer different questions: `featureTest()` is for a
 * sequence of requests that share an identity, `http` is for a single
 * self-contained one.
 */
export interface RequestOptions {
  /** Extra headers. An explicit `Authorization` wins over `actingAs`. */
  headers?: Record<string, string>
  /** Appended to the path as a query string; arrays repeat the key. */
  query?: Record<string, QueryValue>
  /** JSON body. Objects are serialized; a string is sent as-is. */
  body?: unknown
  /** Multipart body. Mutually exclusive with `body`. */
  formData?: Record<string, string | Blob>
  /** Authenticate as this user for this request only. */
  actingAs?: { id: number | string, [k: string]: unknown }
}

const REQUEST_OPTION_KEYS: ReadonlySet<string> = new Set(['headers', 'query', 'body', 'formData', 'actingAs'])

/**
 * A stateless HTTP client for feature tests.
 *
 * Every method takes `(path, options?)` and builds a fresh request, so
 * nothing leaks between tests and there is no client to construct.
 */
export interface HttpClient {
  get: (path: string, options?: RequestOptions) => Promise<FeatureTestResponse>
  post: (path: string, options?: RequestOptions) => Promise<FeatureTestResponse>
  put: (path: string, options?: RequestOptions) => Promise<FeatureTestResponse>
  patch: (path: string, options?: RequestOptions) => Promise<FeatureTestResponse>
  delete: (path: string, options?: RequestOptions) => Promise<FeatureTestResponse>
  head: (path: string, options?: RequestOptions) => Promise<FeatureTestResponse>
  options: (path: string, options?: RequestOptions) => Promise<FeatureTestResponse>
}

/**
 * `?a=1&b=2` for `options.query`, or `''` when there is nothing to append.
 *
 * `undefined` and `null` are dropped rather than sent as the strings
 * `"undefined"` / `"null"`, so an optional filter can be passed through
 * without the caller building the object conditionally. An array repeats the
 * key (`tag=a&tag=b`), which is what every server-side parser in this
 * repository expects.
 */
export function queryString(query: Record<string, QueryValue> | undefined): string {
  if (!query)
    return ''
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null)
      continue
    if (Array.isArray(value)) {
      for (const item of value)
        params.append(key, String(item))
      continue
    }
    params.append(key, String(value))
  }
  const rendered = params.toString()
  return rendered ? `?${rendered}` : ''
}

/**
 * Reject an options object that is really a body.
 *
 * `http.post('/api/users', { name: 'Jane' })` is the mistake this package
 * would otherwise make silently: the object looks like a body, is treated as
 * options, matches no known key, and the request goes out empty. Failing
 * loudly costs one comparison and saves a debugging session.
 */
export function assertRequestOptions(options: RequestOptions, method: string, path: string): void {
  const unknown = Object.keys(options).filter(key => !REQUEST_OPTION_KEYS.has(key))
  if (unknown.length === 0)
    return
  throw new TypeError(
    `http.${method.toLowerCase()}('${path}', …) got unknown option(s) ${unknown.map(k => `'${k}'`).join(', ')}. `
    + `Did you mean to send a body? Wrap it: { body: { ${unknown[0]}: … } }. `
    + `Valid options are ${[...REQUEST_OPTION_KEYS].join(', ')}.`,
  )
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
    ok: res.ok,
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

  async function buildHeaders(spec: Omit<RequestOptions, 'actingAs'>): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      ...extraHeaders,
      ...spec.headers,
    }
    // A multipart body carries a generated boundary in its content type, so
    // `Request` has to set that header itself - writing `multipart/form-data`
    // here without the boundary produces a body no parser can read.
    if (spec.body !== undefined && spec.formData === undefined)
      headers['Content-Type'] = 'application/json'

    const token = await resolveActingToken()
    // An explicit `withHeaders({ Authorization })` wins: a test that sets its
    // own token is deliberately exercising that token, not the acting user's.
    if (token && !headers.Authorization && !headers.authorization)
      headers.Authorization = `Bearer ${token}`

    return headers
  }

  function buildBody(spec: Omit<RequestOptions, 'actingAs'>): BodyInit | undefined {
    if (spec.formData !== undefined) {
      if (spec.body !== undefined)
        throw new TypeError('A request carries either `body` or `formData`, not both.')
      const form = new FormData()
      for (const [key, value] of Object.entries(spec.formData))
        form.append(key, value as string | Blob)
      return form
    }
    if (spec.body === undefined)
      return undefined
    return typeof spec.body === 'string' ? spec.body : JSON.stringify(spec.body)
  }

  async function send(method: string, path: string, spec: Omit<RequestOptions, 'actingAs'> = {}): Promise<FeatureTestResponse> {
    const handler = await resolveServer()
    const base = path.startsWith('http') ? path : `${baseUrl}${path}`
    // Appended rather than assigned, so a path that already carries a query
    // string keeps it: `http.get('/a?b=1', { query: { c: 2 } })`.
    const qs = queryString(spec.query)
    const url = qs && base.includes('?') ? `${base}&${qs.slice(1)}` : `${base}${qs}`
    const init: RequestInit = {
      method,
      headers: await buildHeaders(spec),
      body: buildBody(spec),
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
    request: (method, path, spec) => send(method, path, spec),
    get: path => send('GET', path),
    post: (path, body) => send('POST', path, { body }),
    put: (path, body) => send('PUT', path, { body }),
    patch: (path, body) => send('PATCH', path, { body }),
    delete: (path, body) => send('DELETE', path, { body }),
  }
  return client
}

/**
 * Authenticate as `user`, then make requests.
 *
 * Shorthand for `featureTest().actingAs(user)`, which is how nearly every
 * feature test starts. The returned client is fresh per call, so two tests
 * acting as two users never share a token.
 */
export function actingAs(
  user: { id: number | string, [k: string]: unknown },
  baseUrl?: string,
): FeatureTestClient {
  return featureTest(baseUrl).actingAs(user)
}

/**
 * A request-at-a-time HTTP client for feature tests.
 *
 * Each call constructs its own `featureTest()` client, so `http` holds no
 * state at all: nothing an earlier test set can reach a later one, which is
 * the failure mode a shared module-level client would have.
 *
 * ```ts
 * await http.get('/api/users', { query: { page: 1 } })
 * await http.post('/api/users', { body: { name: 'Jane' } })
 * await http.post('/api/upload', { formData: { file: new File(['x'], 'a.txt') } })
 * ```
 *
 * Note the body is WRAPPED. The fluent client takes a bare body
 * (`featureTest().post('/api/users', { name: 'Jane' })`) because it has no
 * options to disambiguate it from; `http` has, so it cannot. Passing a bare
 * body here throws rather than sending an empty request - see
 * `assertRequestOptions`.
 */
export const http: HttpClient = Object.freeze(
  (['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const).reduce((client, method) => {
    const send = async (path: string, options: RequestOptions = {}): Promise<FeatureTestResponse> => {
      assertRequestOptions(options, method, path)
      const { actingAs: user, ...spec } = options
      const client = featureTest()
      if (user)
        client.actingAs(user)
      return client.request(method, path, spec)
    }
    return { ...client, [method.toLowerCase()]: send }
  }, {} as HttpClient),
)
