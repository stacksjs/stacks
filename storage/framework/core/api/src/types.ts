/**
 * The response shape from any Fetcher request
 * @template T The type of data expected in the response
 */
export interface FetcherResponse<T = any> {
  data: T
  status: number
  headers: Headers
  ok: boolean
}

export type QueryParams = Record<string, string | number | boolean | null | undefined>
export type BodyData = Record<string, any>