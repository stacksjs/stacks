import type { Ref } from '@stacksjs/stx'
import { ref } from '@stacksjs/stx'

interface UseFetchResult {
  data: Ref<any>
  error: Ref<any>
  isFetching: Ref<boolean>
  then: (resolve: (value: { data: Ref<any>, error: Ref<any> }) => void) => Promise<void>
}

export interface FetchBuilder {
  get: () => FetchBuilder
  post: (body?: string) => FetchBuilder
  patch: (body?: string) => FetchBuilder
  put: (body?: string) => FetchBuilder
  delete: () => FetchBuilder
  json: () => UseFetchResult
}

/**
 * Chainable reactive fetch composable.
 *
 * @example
 * ```ts
 * const { error, data } = await useFetch('/api/posts').get().json()
 * const { error, data } = await useFetch('/api/posts').post(JSON.stringify(body)).json()
 * const { error, data } = await useFetch('/api/posts/1').delete().json()
 * ```
 */
export function useFetch(url: string): FetchBuilder {
  let method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'GET'
  let body: string | undefined

  const builder: FetchBuilder = {
    get() {
      method = 'GET'
      body = undefined
      return builder
    },
    post(b?: string) {
      method = 'POST'
      body = b
      return builder
    },
    patch(b?: string) {
      method = 'PATCH'
      body = b
      return builder
    },
    put(b?: string) {
      method = 'PUT'
      body = b
      return builder
    },
    delete() {
      method = 'DELETE'
      body = undefined
      return builder
    },
    json(): UseFetchResult {
      const data = ref<any>(null)
      const error = ref<any>(null)
      const isFetching = ref(true)

      const init: RequestInit = {
        method,
        headers: { Accept: 'application/json' },
      }

      if (body && method !== 'GET' && method !== 'DELETE') {
        init.headers = { ...init.headers, 'Content-Type': 'application/json' }
        init.body = body
      }

      const result = { data, error }
      const fetchPromise = fetch(url, init)
        .then(async (response) => {
          const json = await response.json()
          if (response.ok) {
            data.value = json
          }
          else {
            error.value = json
          }
        })
        .catch((e) => {
          error.value = e
        })
        .finally(() => {
          isFetching.value = false
        })

      return {
        data,
        error,
        isFetching,
        then(resolve) {
          return fetchPromise.then(() => resolve(result))
        },
      }
    },
  }

  return builder
}
