/**
 * A client that knows what every endpoint takes and returns, with no
 * generation step between changing a route and seeing the type change.
 *
 * ## Which client to reach for
 *
 * Stacks has three, and they answer different questions:
 *
 * - **This one.** Same repo (or a workspace package away), TypeScript on both
 *   ends. Reads the route map straight out of `createTypedRouter()`'s type, so
 *   editing an action's `validations` or its return shape is a compile error at
 *   every call site that disagrees - immediately, with no CLI run and no
 *   generated file to go stale.
 * - **The generated REST client** (`buddy generate:openapi` →
 *   `generate-client.ts`). For everything that is not TypeScript in this repo:
 *   native iOS and Android through the Craft bridge, third-party integrators,
 *   Swagger UI. It needs a real OpenAPI document and that pipeline is
 *   unchanged.
 * - **`Fetcher`** (`./fetcher`). Ad hoc calls to anything at all, typed by
 *   whatever you tell it. No route awareness, and none intended.
 *
 * The first two are permanent, not a migration from one to the other.
 *
 * ## Using it
 *
 * ```ts
 * import type { AppRoutes } from '../routes/api'
 * import { createTypedClient } from '@stacksjs/api/typed-client'
 *
 * const client = createTypedClient<AppRoutes>({ baseUrl: 'https://api.example.com' })
 *
 * const projects = await client.get('/v1/projects')
 * const one = await client.get('/v1/projects/{id}', { params: { id: '42' } })
 * const created = await client.post('/v1/projects', { name: 'apollo', budget: 1200 })
 * ```
 *
 * A path the API does not serve is a compile error. A body that does not match
 * the action's `validations` is a compile error. The awaited result is the
 * action's own return type.
 *
 * ## What it does not promise
 *
 * The output type is the action's return type as TypeScript sees it, not a
 * model of what JSON does to it - a `Date` in a response body arrives as a
 * string, and the type will still say `Date`. An action that returns a
 * `Response` or a stream has taken over the wire format itself and is typed
 * `unknown`, which is the honest answer.
 */

import type { PathsForMethod, RouteMapOf, TypedRouteMap } from '@stacksjs/types'

/** A response the server refused. Carries the parsed body when there was one. */
export class TypedClientError extends Error {
  readonly status: number
  readonly response: Response
  readonly body: unknown

  constructor(response: Response, body: unknown) {
    const detail = typeof (body as { message?: unknown })?.message === 'string'
      ? (body as { message: string }).message
      : response.statusText || 'Request failed'

    super(`${response.status} ${detail}`)
    this.name = 'TypedClientError'
    this.status = response.status
    this.response = response
    this.body = body
  }
}

export interface TypedClientOptions {
  /** Where the API lives. A trailing slash is fine. */
  baseUrl: string
  /**
   * Headers on every request. A function is called per request, so an auth
   * token that rotates does not have to be a new client.
   */
  headers?: Record<string, string> | (() => Record<string, string> | Promise<Record<string, string>>)
  /** Swap the fetch implementation - a test double, or one that retries. */
  fetch?: typeof globalThis.fetch
  credentials?: RequestCredentials
  /**
   * Called instead of throwing when the server answers 4xx/5xx. Return a value
   * to have it become the call's result; throw to keep the default behaviour.
   */
  onError?: (error: TypedClientError) => unknown
}

/** Per-call options. `params` is required when the path has any. */
export interface TypedRequestOptions<TParams extends Record<string, string>> {
  params?: TParams
  query?: Record<string, string | number | boolean | undefined>
  headers?: Record<string, string>
  signal?: AbortSignal
}

type Route<T, M extends string, P extends string>
  = RouteMapOf<T> extends infer R
    ? (R extends TypedRouteMap ? (`${M} ${P}` extends keyof R ? R[`${M} ${P}`] : never) : never)
    : never

type Input<T, M extends string, P extends string> = Route<T, M, P>['input']
type Output<T, M extends string, P extends string> = Route<T, M, P>['output']
type Params<T, M extends string, P extends string> = Route<T, M, P>['params']

type Paths<T, M extends string>
  = RouteMapOf<T> extends infer R
    ? (R extends TypedRouteMap ? PathsForMethod<R, M> : never)
    : never

export interface TypedClient<T> {
  get: <P extends Paths<T, 'GET'>>(path: P, options?: TypedRequestOptions<Params<T, 'GET', P>>)
  => Promise<Output<T, 'GET', P>>
  post: <P extends Paths<T, 'POST'>>(path: P, body: Input<T, 'POST', P>, options?: TypedRequestOptions<Params<T, 'POST', P>>)
  => Promise<Output<T, 'POST', P>>
  put: <P extends Paths<T, 'PUT'>>(path: P, body: Input<T, 'PUT', P>, options?: TypedRequestOptions<Params<T, 'PUT', P>>)
  => Promise<Output<T, 'PUT', P>>
  patch: <P extends Paths<T, 'PATCH'>>(path: P, body: Input<T, 'PATCH', P>, options?: TypedRequestOptions<Params<T, 'PATCH', P>>)
  => Promise<Output<T, 'PATCH', P>>
  delete: <P extends Paths<T, 'DELETE'>>(path: P, options?: TypedRequestOptions<Params<T, 'DELETE', P>>)
  => Promise<Output<T, 'DELETE', P>>
  /**
   * The untyped escape hatch, for when you need the `Response` itself -
   * a redirect to follow by hand, a header to read, a body to stream.
   */
  raw: (method: string, path: string, init?: RequestInit & { params?: Record<string, string>, query?: Record<string, unknown> })
  => Promise<Response>
}

/**
 * Fill `{name}` and `:name` placeholders.
 *
 * Both forms, because the router accepts both and a client that understood only
 * one would work until somebody wrote a route the other way. Values are
 * percent-encoded: a path param is caller data, and an unescaped `/` in one
 * silently addresses a different endpoint.
 */
function fillParams(path: string, params?: Record<string, string>): string {
  if (!params)
    return path

  let filled = path
  for (const [key, value] of Object.entries(params)) {
    const encoded = encodeURIComponent(value)
    filled = filled.split(`{${key}}`).join(encoded)
    filled = filled.replace(new RegExp(`:${key}(?![A-Z0-9_])`, 'gi'), encoded)
  }
  return filled
}

function withQuery(url: string, query?: Record<string, unknown>): string {
  if (!query)
    return url

  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null)
      search.append(key, String(value))
  }

  const rendered = search.toString()
  if (!rendered)
    return url

  return url.includes('?') ? `${url}&${rendered}` : `${url}?${rendered}`
}

/**
 * Read the body the way its content type says to.
 *
 * A 204 has nothing to read, and calling `.json()` on it throws - which turned
 * every successful delete into a client-side error.
 */
async function readBody(response: Response): Promise<unknown> {
  if (response.status === 204 || response.headers.get('content-length') === '0')
    return undefined

  const type = response.headers.get('content-type') ?? ''
  if (type.includes('json')) {
    try {
      return await response.json()
    }
    catch {
      // A body that claims to be JSON and is not is the server's problem to
      // fix; handing back the text is more useful than throwing over it.
      return undefined
    }
  }

  return await response.text()
}

export function createTypedClient<T>(options: TypedClientOptions): TypedClient<T> {
  const base = options.baseUrl.replace(/\/+$/, '')
  const doFetch = options.fetch ?? globalThis.fetch

  async function baseHeaders(): Promise<Record<string, string>> {
    if (typeof options.headers === 'function')
      return await options.headers()
    return options.headers ?? {}
  }

  async function send(
    method: string,
    path: string,
    body: unknown,
    hasBody: boolean,
    opts?: TypedRequestOptions<Record<string, string>>,
  ): Promise<unknown> {
    const url = withQuery(`${base}${fillParams(path, opts?.params)}`, opts?.query)

    const headers: Record<string, string> = { accept: 'application/json', ...(await baseHeaders()), ...opts?.headers }
    if (hasBody && headers['content-type'] === undefined && headers['Content-Type'] === undefined)
      headers['content-type'] = 'application/json'

    const response = await doFetch(url, {
      method,
      headers,
      ...(hasBody ? { body: JSON.stringify(body) } : {}),
      ...(options.credentials ? { credentials: options.credentials } : {}),
      ...(opts?.signal ? { signal: opts.signal } : {}),
    })

    const parsed = await readBody(response)

    if (!response.ok) {
      const error = new TypedClientError(response, parsed)
      if (options.onError)
        return options.onError(error)
      throw error
    }

    return parsed
  }

  return {
    get: ((path: string, opts?: any) => send('GET', path, undefined, false, opts)) as TypedClient<T>['get'],
    post: ((path: string, body: unknown, opts?: any) => send('POST', path, body, true, opts)) as TypedClient<T>['post'],
    put: ((path: string, body: unknown, opts?: any) => send('PUT', path, body, true, opts)) as TypedClient<T>['put'],
    patch: ((path: string, body: unknown, opts?: any) => send('PATCH', path, body, true, opts)) as TypedClient<T>['patch'],
    delete: ((path: string, opts?: any) => send('DELETE', path, undefined, false, opts)) as TypedClient<T>['delete'],

    async raw(method, path, init) {
      const { params, query, ...rest } = init ?? {}
      const url = withQuery(`${base}${fillParams(path, params)}`, query)

      return await doFetch(url, {
        method,
        ...rest,
        headers: { ...(await baseHeaders()), ...(rest.headers as Record<string, string> | undefined) },
        ...(options.credentials ? { credentials: options.credentials } : {}),
      })
    },
  }
}
