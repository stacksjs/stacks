import { ofetch } from 'ofetch'
import type { FetchOptions } from 'ofetch'
interface Params {
  [key: string]: any // Replace 'any' with more specific types if possible
}

type FetchResponse = string | Blob | ArrayBuffer | ReadableStream<Uint8Array>

const loading = ref(false)
const token = ref('')

export async function useHttpFetch(endpoint = '') {
  let baseURL = '/'

  if (endpoint)
    baseURL = endpoint

  async function post(url: string, params?: Params): Promise<any> {
    const headers: any = { Accept: 'application/json' };

    if (token.value) {
      headers.Authorization = `Bearer ${token.value}`;
    }

    const parameters: FetchOptions = {
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
      const result: string | FetchResponse | Blob | ArrayBuffer | ReadableStream<Uint8Array> = await ofetch(url, parameters)

      loading.value = false
      return result
    }
    catch (err: any) {
      loading.value = false

      throw err
    }
  }

  async function get(url: string, params?: Params): Promise<any> {
    const headers: any = { Accept: 'application/json' };

    if (token.value) {
      headers.Authorization = `Bearer ${token.value}`;
    }
    
    const parameters: FetchOptions = {
      ...params,
      ...{
        headers,
        parseResponse: JSON.parse,
        method: 'GET',
        baseURL,
      },
    }

    try {
      const result: FetchResponse = await ofetch(url, parameters)
      return result
    }
    catch (err: any) {
      throw err
    }
  }

  async function patch(url: string, params?: Params): Promise<any> {
    const headers: any = { Accept: 'application/json' };

    if (token.value) {
      headers.Authorization = `Bearer ${token.value}`;
    }

    const parameters: FetchOptions = {
      ...params,
      ...{
        headers,
        parseResponse: JSON.parse,
        method: 'PATCH',
        baseURL,
      },
    }

    loading.value = true
    try {
      const result: FetchResponse = await ofetch(url, parameters)

      loading.value = false
      return result
    }
    catch (err: any) {
      throw err
    }
  }

  async function destroy(url: string, params?: Params): Promise<any> {
    const headers: any = { Accept: 'application/json' };

    if (token.value) {
      headers.Authorization = `Bearer ${token.value}`;
    }

    const parameters: FetchOptions = {
      ...params,
      ...{
        headers,
        method: 'DELETE',
        baseURL,
      },
    }

    loading.value = true
    try {
      const result: FetchResponse = await ofetch(url, parameters)

      loading.value = false
      return result
    }
    catch (err: any) {
      throw err
    }
  }

  function setToken(authToken: string) {
    token.value = authToken
  }

  return { post, get, patch, destroy, baseURL, loading, token, setToken }
}
