import { ofetch } from 'ofetch'

interface Params {
  [key: string]: any // Replace 'any' with more specific types if possible
}
interface FetchRequestHeaders {
  'Content-Type'?: string;
  'Authorization'?: string;
  'Accept'?: string;
  'User-Agent'?: string;
  'Referer'?: string;
  'Origin'?: string;
  'Cache-Control'?: string;
  'Pragma'?: string;
  'Cookie'?: string;
  'If-Modified-Since'?: string;
  'If-None-Match'?: string;
  'X-Requested-With'?: string;
  'Accept-Encoding'?: string;
  'Accept-Language'?: string;
  [key: string]: string | undefined; // To allow additional headers
}

interface FetchRequestParams {
  headers?: FetchRequestHeaders;
  method?: string;
  baseURL?: string;
  body?: any; // Optional, for request bodies like in POST or PUT requests
  mode?: RequestMode; // Optional, e.g., 'cors', 'no-cors', 'same-origin'
  credentials?: RequestCredentials; // Optional, e.g., 'include', 'same-origin', 'omit'
  cache?: RequestCache; // Optional, e.g., 'default', 'no-store', 'reload'
  redirect?: RequestRedirect; // Optional, e.g., 'follow', 'manual', 'error'
  referrerPolicy?: ReferrerPolicy; // Optional, e.g., 'no-referrer', 'origin'
  integrity?: string; // Optional, for subresource integrity
  keepalive?: boolean; // Optional, for whether the request should outlive the page
  signal?: AbortSignal; // Optional, to abort the request
  [key: string]: any; // To allow additional parameters
}

type FetchResponse = string | Blob | ArrayBuffer | ReadableStream<Uint8Array>

const loading = ref(false)
const token = ref('')


let baseURL = '/'

async function post(url: string, params?: Params): Promise<any> {
  const headers: FetchRequestHeaders = { Accept: 'application/json' }

  if (token.value) headers.Authorization = `Bearer ${token.value}`

  const parameters: FetchRequestParams = {
    ...params,
    ...{
      headers,
      parseResponse: JSON.parse,
      method: 'POST',
      baseURL,
    },
  }

  loading.value = true

  try {
    const result: string | FetchResponse | Blob | ArrayBuffer | ReadableStream<Uint8Array> = await ofetch(
      url,
      parameters,
    )

    loading.value = false
    return result
  } catch (err: any) {
    loading.value = false

    throw err
  }
}

async function get(url: string, params?: Params): Promise<any> {
  const headers: FetchRequestHeaders = { Accept: 'application/json' }

  if (token.value) headers.Authorization = `Bearer ${token.value}`

  const parameters: FetchRequestParams = {
    ...params,
    ...{
      headers,
      parseResponse: JSON.parse,
      method: 'GET',
      baseURL,
    },
  }

  return (await ofetch(url, parameters)) as FetchResponse
}

async function patch(url: string, params?: Params): Promise<any> {
  const headers: FetchRequestHeaders = { Accept: 'application/json' }

  if (token.value) headers.Authorization = `Bearer ${token.value}`

  const parameters: FetchRequestParams = {
    ...params,
    ...{
      headers,
      parseResponse: JSON.parse,
      method: 'PATCH',
      baseURL,
    },
  }

  loading.value = true

  return (await ofetch(url, parameters)) as FetchResponse
}

async function destroy(url: string, params?: Params): Promise<any> {
  const headers: FetchRequestHeaders = { Accept: 'application/json' }

  if (token.value) headers.Authorization = `Bearer ${token.value}`

  const parameters: FetchRequestParams = {
    ...params,
    ...{
      headers,
      method: 'DELETE',
      baseURL,
    },
  }

  loading.value = true

  return (await ofetch(url, parameters)) as FetchResponse
}

function setToken(authToken: string) {
  token.value = authToken
}

export const Fetch = { 
  post, 
  get, 
  patch, 
  destroy, 
  baseURL, 
  loading, 
  token, 
  setToken 
}
