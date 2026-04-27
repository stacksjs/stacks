import { ofetch } from 'ofetch'

/**
 * Loose payload type for `Fetch.{get,post,patch,put,destroy}`.
 *
 * GET sends this as a query string; POST/PATCH/PUT send it as a JSON body.
 * Values are constrained to JSON-serializable primitives + nested
 * arrays/objects so we catch unintentional `Function` / `Date` / `Symbol`
 * payloads at the call site instead of seeing them silently coerced
 * to `[object Object]` over the wire.
 */
type Primitive = string | number | boolean | null | undefined
interface Params {
  [key: string]: Primitive | Primitive[] | Params | Params[]
}

interface ApiFetch {
  get: (url: string, params?: Params, header?: Headers) => Promise<FetchResponse>
  post: (url: string, params?: Params, header?: Headers) => Promise<FetchResponse>
  destroy: (url: string, params?: Params, header?: Headers) => Promise<FetchResponse>
  patch: (url: string, params?: Params, header?: Headers) => Promise<FetchResponse>
  put: (url: string, params?: Params, header?: Headers) => Promise<FetchResponse>
  setToken: (authToken: string) => void
  baseURL: '/' | string
  loading: boolean
  token: string
}

type FetchResponse = string | Blob | ArrayBuffer | ReadableStream<Uint8Array>

let loading = false
let token = ''
const baseURL = '/'

async function get(url: string, params?: Params, headers?: Headers): Promise<FetchResponse> {
  if (headers) {
    if (token)
      headers.set('Authorization', `Bearer ${token}`)
  }

  return await ofetch(url, { method: 'GET', baseURL, params, headers })
}

// State-changing verbs send `params` as the request body, not as a query
// string — POST/PATCH/PUT consumers expect `Fetch.post('/api/cars', { make: 'BMW' })`
// to put `{ make: 'BMW' }` in the body, the way every Laravel/Inertia/axios
// app on the planet does. The previous `params: params` shape forwarded
// the payload to ofetch's `params` option, which serializes to the query
// string — silently turning POSTs into "POST with empty body and url
// noise" and 422'ing every fillable-required check on the server.

async function post(url: string, params?: Params, headers?: Headers): Promise<any> {
  if (headers) {
    if (token)
      headers.set('Authorization', `Bearer ${token}`)
  }

  loading = true

  try {
    const result: string | FetchResponse | Blob | ArrayBuffer | ReadableStream<Uint8Array> = await ofetch(url, {
      method: 'POST',
      baseURL,
      body: params,
      headers,
    })

    loading = false
    return result
  }
  catch (err: any) {
    loading = false

    throw err
  }
}

async function patch(url: string, params?: Params, headers?: Headers): Promise<FetchResponse> {
  if (headers) {
    if (token)
      headers.set('Authorization', `Bearer ${token}`)
  }

  loading = true

  try {
    const result = await ofetch(url, {
      method: 'PATCH',
      baseURL,
      body: params,
      headers,
    })
    loading = false
    return result
  }
  catch (err) {
    loading = false
    throw err
  }
}

async function put(url: string, params?: Params, headers?: Headers): Promise<FetchResponse> {
  if (headers) {
    if (token)
      headers.set('Authorization', `Bearer ${token}`)
  }

  loading = true

  try {
    const result = await ofetch(url, {
      method: 'PUT',
      baseURL,
      body: params,
      headers,
    })
    loading = false
    return result
  }
  catch (err) {
    loading = false
    throw err
  }
}

async function destroy(url: string, params?: Params, headers?: Headers): Promise<FetchResponse> {
  if (headers) {
    if (token)
      headers.set('Authorization', `Bearer ${token}`)
  }

  loading = true

  try {
    const result = await ofetch(url, {
      method: 'DELETE',
      baseURL,
      params,
      headers,
    })
    loading = false
    return result
  }
  catch (err) {
    loading = false
    throw err
  }
}

function setToken(authToken: string): void {
  token = authToken
}

export const Fetch: ApiFetch = {
  get,
  post,
  patch,
  put,
  destroy,
  baseURL,
  token,
  setToken,
  loading,
}
