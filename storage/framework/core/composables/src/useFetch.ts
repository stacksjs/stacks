import type { Ref } from '@stacksjs/stx'
import { ref } from '@stacksjs/stx'

/**
 * Result of a terminal `.json()` call. Generic over the success body
 * `T` (stacksjs/stacks#1924) so `data.value` is typed instead of
 * `any`. `error` stays `unknown` — it can be a parsed error body OR a
 * thrown network error, so the caller should narrow before use.
 */
export interface UseFetchResult<T = unknown> {
  data: Ref<T | null>
  error: Ref<unknown>
  isFetching: Ref<boolean>
  then: (resolve: (value: { data: Ref<T | null>, error: Ref<unknown> }) => void) => Promise<void>
}

export interface FetchBuilder<T = unknown> {
  get: () => FetchBuilder<T>
  post: (body?: string) => FetchBuilder<T>
  patch: (body?: string) => FetchBuilder<T>
  put: (body?: string) => FetchBuilder<T>
  delete: () => FetchBuilder<T>
  json: () => UseFetchResult<T>
}

/**
 * Chainable reactive fetch composable. Pass the expected success body
 * shape as the type argument to get a typed `data.value`.
 *
 * @example
 * ```ts
 * interface Post { id: number, title: string }
 * const { error, data } = await useFetch<Post[]>('/api/posts').get().json()
 * //      data: Ref<Post[] | null>
 * const { data } = await useFetch<Post>('/api/posts').post(JSON.stringify(body)).json()
 * const { error } = await useFetch('/api/posts/1').delete().json()
 * ```
 */
export function useFetch<T = unknown>(url: string): FetchBuilder<T> {
  let method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'GET'
  let body: string | undefined

  const builder: FetchBuilder<T> = {
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
    json(): UseFetchResult<T> {
      const data = ref<T | null>(null)
      const error = ref<unknown>(null)
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
