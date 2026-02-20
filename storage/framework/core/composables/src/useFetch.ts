import type { Ref } from '@stacksjs/stx'
import { HttxClient } from '@stacksjs/httx'
import { ref } from '@stacksjs/stx'

interface UseFetchResult {
  data: Ref<any>
  error: Ref<any>
  isFetching: Ref<boolean>
  then: (resolve: (value: { data: Ref<any>, error: Ref<any> }) => void) => Promise<{ data: Ref<any>, error: Ref<any> }>
}

interface FetchBuilder {
  get: () => FetchBuilder
  post: (body?: string) => FetchBuilder
  patch: (body?: string) => FetchBuilder
  put: (body?: string) => FetchBuilder
  delete: () => FetchBuilder
  json: () => UseFetchResult
}

const client = new HttxClient()

/**
 * Chainable reactive fetch composable backed by @stacksjs/httx.
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

      let parsedBody: any
      if (body) {
        try {
          parsedBody = JSON.parse(body)
        }
        catch {
          parsedBody = body
        }
      }

      const fetchPromise = client.request(url, {
        method,
        json: method !== 'GET' && method !== 'DELETE',
        body: parsedBody,
        headers: {
          Accept: 'application/json',
        },
      })
        .then((result) => {
          if (result.isOk) {
            data.value = result.value.data
          }
          else {
            error.value = result.error
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
          return fetchPromise.then(() => resolve({ data, error }))
        },
      }
    },
  }

  return builder
}
