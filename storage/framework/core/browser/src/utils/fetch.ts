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

type FetchResponse = string | Blob | ArrayBuffer | ReadableStream<Uint8Array> | object

let loading = false
let token = ''
const baseURL = '/'

function appendParam(search: URLSearchParams, key: string, value: unknown): void {
  if (value === undefined || value === null)
    return
  if (Array.isArray(value)) {
    for (const v of value) appendParam(search, key, v)
    return
  }
  if (typeof value === 'object') {
    search.append(key, JSON.stringify(value))
    return
  }
  search.append(key, String(value))
}

function buildUrl(url: string, params?: Params): string {
  const absolute = /^https?:\/\//i.test(url)
  const full = absolute ? url : `${baseURL.replace(/\/$/, '')}/${url.replace(/^\//, '')}`
  if (!params || Object.keys(params).length === 0)
    return full
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) appendParam(search, key, value)
  const qs = search.toString()
  if (!qs)
    return full
  return full.includes('?') ? `${full}&${qs}` : `${full}?${qs}`
}

function applyAuth(headers?: Headers): Headers {
  const h = headers ?? new Headers()
  if (token && !h.has('Authorization'))
    h.set('Authorization', `Bearer ${token}`)
  return h
}

async function parseBody(response: Response): Promise<FetchResponse> {
  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('application/json'))
    return await response.json()
  if (contentType.startsWith('text/') || contentType.includes('xml'))
    return await response.text()
  return await response.blob()
}

async function request(
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  url: string,
  params?: Params,
  headers?: Headers,
): Promise<FetchResponse> {
  const sendsBody = method !== 'GET' && method !== 'DELETE'
  const finalUrl = sendsBody ? buildUrl(url) : buildUrl(url, params)
  const finalHeaders = applyAuth(headers)
  const init: RequestInit = { method, headers: finalHeaders }

  if (sendsBody && params !== undefined) {
    if (!finalHeaders.has('Content-Type'))
      finalHeaders.set('Content-Type', 'application/json')
    init.body = JSON.stringify(params)
  }

  if (sendsBody)
    loading = true

  try {
    const response = await fetch(finalUrl, init)
    if (!response.ok) {
      const errorBody = await parseBody(response).catch(() => null)
      const error: any = new Error(`Request failed with status ${response.status}`)
      error.status = response.status
      error.data = errorBody
      throw error
    }
    return await parseBody(response)
  }
  finally {
    if (sendsBody)
      loading = false
  }
}

async function get(url: string, params?: Params, headers?: Headers): Promise<FetchResponse> {
  return await request('GET', url, params, headers)
}

async function post(url: string, params?: Params, headers?: Headers): Promise<FetchResponse> {
  return await request('POST', url, params, headers)
}

async function patch(url: string, params?: Params, headers?: Headers): Promise<FetchResponse> {
  return await request('PATCH', url, params, headers)
}

async function put(url: string, params?: Params, headers?: Headers): Promise<FetchResponse> {
  return await request('PUT', url, params, headers)
}

async function destroy(url: string, params?: Params, headers?: Headers): Promise<FetchResponse> {
  return await request('DELETE', url, params, headers)
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
