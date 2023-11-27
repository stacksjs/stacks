import { ofetch } from 'ofetch'
import { config, localUrl } from '@stacksjs/config'
import { ref } from 'vue'
interface Params {
  [key: string]: any // Replace 'any' with more specific types if possible
}

interface FetchParams {
  headers: {
    Accept: string
    Authorization: string
  }
  parseResponse: (text: string) => any
  method: string
  baseURL: string
  [key: string]: any // To account for the spread of the '...params'
}

interface FetchResponse {
  data: any // Replace 'any' with more specific types if possible
}

const loading = ref(false)
const token = ref('')

export async function useHttpFetch(endpoint = '') {
  let baseURL = await localUrl({ domain: config.app.url })

  if (endpoint)
    baseURL = endpoint

  async function post(url: string, params?: Params): Promise<any> {
    const parameters: FetchParams = {
      ...params,
      ...{
        headers: { Accept: 'application/json', Authorization: `Bearer ${token.value}` },
        parseResponse: JSON.parse,
        method: 'POST',
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
      loading.value = false

      throw err
    }
  }

  async function get(url: string, params?: Params): Promise<any> {
    const parameters: FetchParams = {
      ...params,
      ...{
        headers: { Accept: 'application/json', Authorization: `Bearer ${token.value}` },
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
    const parameters: FetchParams = {
      ...params,
      ...{
        headers: { Accept: 'application/json', Authorization: `Bearer ${token.value}` },
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
    const parameters: FetchParams = {
      ...params,
      ...{
        headers: { Accept: 'application/json', Authorization: `Bearer ${token.value}` },
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
