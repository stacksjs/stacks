import type { Ref } from 'vue'
import { ofetch } from 'ofetch'
import { ref } from 'vue'

interface Params {
  [key: string]: any
}

type FetchResponse = string | Blob | ArrayBuffer | ReadableStream<Uint8Array>

interface UseFetchReturn {
  get: (url: string, params?: Params, headers?: Headers) => Promise<FetchResponse>
  post: (url: string, params?: Params, headers?: Headers) => Promise<FetchResponse>
  patch: (url: string, params?: Params, headers?: Headers) => Promise<FetchResponse>
  put: (url: string, params?: Params, headers?: Headers) => Promise<FetchResponse>
  destroy: (url: string, params?: Params, headers?: Headers) => Promise<FetchResponse>
  setToken: (authToken: string) => void
  loading: Ref<boolean>
  token: Ref<string>
  baseURL: Ref<string>
}

export function useFetch(): UseFetchReturn {
  const loading = ref(false)
  const token = ref('')
  const baseURL = ref('/')

  const setToken = (authToken: string): void => {
    token.value = authToken
  }

  const getHeaders = (headers?: Headers): Headers | undefined => {
    if (headers && token.value) {
      headers.set('Authorization', `Bearer ${token.value}`)
    }
    return headers
  }

  const get = async (url: string, params?: Params, headers?: Headers): Promise<FetchResponse> => {
    return await ofetch(url, {
      method: 'GET',
      baseURL: baseURL.value,
      params,
      headers: getHeaders(headers),
    })
  }

  const post = async (url: string, params?: Params, headers?: Headers): Promise<FetchResponse> => {
    loading.value = true
    try {
      const result = await ofetch(url, {
        method: 'POST',
        baseURL: baseURL.value,
        params,
        headers: getHeaders(headers),
      })
      return result
    }
    finally {
      loading.value = false
    }
  }

  const patch = async (url: string, params?: Params, headers?: Headers): Promise<FetchResponse> => {
    loading.value = true
    try {
      return await ofetch(url, {
        method: 'PATCH',
        baseURL: baseURL.value,
        params,
        headers: getHeaders(headers),
      })
    }
    finally {
      loading.value = false
    }
  }

  const put = async (url: string, params?: Params, headers?: Headers): Promise<FetchResponse> => {
    loading.value = true
    try {
      return await ofetch(url, {
        method: 'PUT',
        baseURL: baseURL.value,
        params,
        headers: getHeaders(headers),
      })
    }
    finally {
      loading.value = false
    }
  }

  const destroy = async (url: string, params?: Params, headers?: Headers): Promise<FetchResponse> => {
    loading.value = true
    try {
      return await ofetch(url, {
        method: 'DELETE',
        baseURL: baseURL.value,
        params,
        headers: getHeaders(headers),
      })
    }
    finally {
      loading.value = false
    }
  }

  return {
    get,
    post,
    patch,
    put,
    destroy,
    setToken,
    loading,
    token,
    baseURL,
  }
}
