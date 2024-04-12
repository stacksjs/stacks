import { ref } from 'vue'
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
    const headers: any = { Accept: 'application/json' }

    if (token.value)
      headers.Authorization = `Bearer ${token.value}`

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
    const headers: any = { Accept: 'application/json' }

    if (token.value)
      headers.Authorization = `Bearer ${token.value}`

    const parameters: FetchOptions = {
      ...params,
      ...{
        headers,
        parseResponse: JSON.parse,
        method: 'GET',
        baseURL,
      },
    }

    return await ofetch(url, parameters) as FetchResponse
  }

  async function patch(url: string, params?: Params): Promise<any> {
    const headers: any = { Accept: 'application/json' }

    if (token.value)
      headers.Authorization = `Bearer ${token.value}`

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

    return await ofetch(url, parameters) as FetchResponse
  }

  async function destroy(url: string, params?: Params): Promise<any> {
    const headers: any = { Accept: 'application/json' }

    if (token.value)
      headers.Authorization = `Bearer ${token.value}`

    const parameters: FetchOptions = {
      ...params,
      ...{
        headers,
        method: 'DELETE',
        baseURL,
      },
    }

    loading.value = true

    return await ofetch(url, parameters) as FetchResponse
  }

  function setToken(authToken: string) {
    token.value = authToken
  }

  return { post, get, patch, destroy, baseURL, loading, token, setToken }
}
