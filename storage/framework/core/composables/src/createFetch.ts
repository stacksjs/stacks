import { useFetch } from './useFetch'

export interface CreateFetchOptions {
  /** Base URL prepended to all requests */
  baseUrl?: string
  /** Default options for all requests */
  options?: RequestInit
}

/**
 * Create a pre-configured useFetch instance with a base URL and default options.
 *
 * @example
 * ```ts
 * const useMyFetch = createFetch({ baseUrl: '/api' })
 * const { data, error } = await useMyFetch('/users').get().json()
 * ```
 */
export function createFetch(config: CreateFetchOptions = {}) {
  const { baseUrl = '' } = config

  return function (url: string) {
    const fullUrl = baseUrl ? `${baseUrl.replace(/\/$/, '')}/${url.replace(/^\//, '')}` : url
    return useFetch(fullUrl)
  }
}
