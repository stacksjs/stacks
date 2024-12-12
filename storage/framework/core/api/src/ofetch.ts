import { ofetch } from 'ofetch'

interface Params {
  [key: string]: any // Replace 'any' with more specific types if possible
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
      params,
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

  return await ofetch(url, {
    method: 'PATCH',
    baseURL,
    params,
    headers,
  })
}

async function put(url: string, params?: Params, headers?: Headers): Promise<FetchResponse> {
  if (headers) {
    if (token)
      headers.set('Authorization', `Bearer ${token}`)
  }

  loading = true

  return await ofetch(url, {
    method: 'PUT',
    baseURL,
    params,
    headers,
  })
}

async function destroy(url: string, params?: Params, headers?: Headers): Promise<FetchResponse> {
  if (headers) {
    if (token)
      headers.set('Authorization', `Bearer ${token}`)
  }

  loading = true

  return await ofetch(url, {
    method: 'DELETE',
    baseURL,
    params,
    headers,
  })
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
