import { ofetch } from 'ofetch'

const loading = ref(false)
const token = ref('')

let bearerToken: string | null = ''

if (typeof window !== 'undefined')
  bearerToken = window.localStorage.getItem('bearerToken')

export function useHttpFetch() {
  const baseURL = import.meta.env.VITE_API_BASE_URL

  async function post(url: string, params?: any): Promise<any> {
    const parameters = {
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
      const result = await ofetch(url, parameters)

      loading.value = false
      return result
    }
    catch (err: any) {
      loading.value = false

      throw err
    }
  }

  async function get(url: string, params?: any): Promise<any> {
    const parameters = {
      ...params,
      ...{
        headers: { Accept: 'application/json', Authorization: `Bearer ${token.value || bearerToken}` },
        parseResponse: JSON.parse,
        method: 'GET',
        baseURL,
      },
    }

    const result = await ofetch(url, parameters)

    return result
  }

  async function patch(url: string, params?: any): Promise<any> {
    const parameters = {
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
      const result = await ofetch(url, parameters)

      loading.value = false
      return result
    }
    catch (err: any) {
      loading.value = false
      throw err
    }
  }

  async function destroy(url: string, params?: any): Promise<any> {
    const parameters = {
      ...params,
      ...{
        headers: { Accept: 'application/json', Authorization: `Bearer ${token.value || bearerToken}` },
        method: 'DELETE',
        baseURL,
      },
    }

    loading.value = true
    try {
      const result = await ofetch(url, parameters)

      loading.value = false
      return result
    }
    catch (err: any) {
      loading.value = false

      throw err
    }
  }

  function setToken(authToken: string) {
    token.value = authToken
  }

  return { post, get, patch, destroy, loading, token, setToken }
}
