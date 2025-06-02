/**
 * The response shape from any Fetcher request
 * @template T The type of data expected in the response
 */
export interface FetcherResponse<T = any> {
  data: T
  status: number
  headers: Headers
  isOk: boolean

  // 2xx Success
  ok: () => boolean // 200 OK
  created: () => boolean // 201 Created
  accepted: () => boolean // 202 Accepted
  noContent: () => boolean // 204 No Content

  // 3xx Redirection
  movedPermanently: () => boolean // 301 Moved Permanently
  found: () => boolean // 302 Found

  // 4xx Client Errors
  badRequest: () => boolean // 400 Bad Request
  unauthorized: () => boolean // 401 Unauthorized
  paymentRequired: () => boolean // 402 Payment Required
  forbidden: () => boolean // 403 Forbidden
  notFound: () => boolean // 404 Not Found
  requestTimeout: () => boolean // 408 Request Timeout
  conflict: () => boolean // 409 Conflict
  unprocessableEntity: () => boolean // 422 Unprocessable Entity
  tooManyRequests: () => boolean // 429 Too Many Requests

  // 5xx Server Errors
  serverError: () => boolean // 500 Internal Server Error
}

export type QueryParams = Record<string, string | number | boolean | null | undefined>
export type BodyData = Record<string, any>

export interface FileAttachment {
  name: string
  content: Blob
  filename?: string
  headers?: Record<string, string>
}
