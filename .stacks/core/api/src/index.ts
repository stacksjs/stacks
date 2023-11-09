import { ofetch } from 'ofetch'
import { flare } from '@flareapp/flare-client'
import { config, localUrl } from '@stacksjs/config'

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

let bearerToken: string | null = ''

if (typeof window !== 'undefined')
  bearerToken = window.localStorage.getItem('bearerToken')

export function useHttpFetch(endpoint = '') {
  let baseURL = localUrl(config.app.url)

  if (endpoint)
    baseURL = endpoint

  async function post(url: string, params?: Params): Promise<any> {
    const parameters: FetchParams = {
      ...params,
      ...{
        headers: { Accept: 'application/json', Authorization: `Bearer ${token.value || bearerToken}` },
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
      flare.report(errReport)

      if (err.status === 401)
        logout()

      loading.value = false

      throw err
    }
  }

  async function get(url: string, params?: Params): Promise<any> {
    const parameters: FetchParams = {
      ...params,
      ...{
        headers: { Accept: 'application/json', Authorization: `Bearer ${token.value || bearerToken}` },
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
      flare.report(err)
      if (err.status === 401)
        logout()

      throw err
    }
  }

  async function patch(url: string, params?: Params): Promise<any> {
    const parameters: FetchParams = {
      ...params,
      ...{
        headers: { Accept: 'application/json', Authorization: `Bearer ${token.value || bearerToken}` },
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
      flare.report(err)
      loading.value = false
      throw err
    }
  }

  async function destroy(url: string, params?: Params): Promise<any> {
    const parameters: FetchParams = {
      ...params,
      ...{
        headers: { Accept: 'application/json', Authorization: `Bearer ${token.value || bearerToken}` },
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
      flare.report(err)
      loading.value = false

      throw err
    }
  }

  function setToken(authToken: string) {
    token.value = authToken
  }

  function logout() {
    if (typeof window !== 'undefined')
      window.localStorage.clear()

    window.location.href = '/login'
  }

  return { post, get, patch, destroy, baseURL, loading, token, setToken }
}
