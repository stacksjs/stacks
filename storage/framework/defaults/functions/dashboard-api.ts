import type { ApiErrorBody } from '@stacksjs/browser/composables/request-error'
import { withCsrfHeader } from '@stacksjs/browser/composables/csrf'
import { describeResponseError } from '@stacksjs/browser/composables/request-error'
import { useAuth } from './auth'

/**
 * Dashboard API client.
 *
 * Every mutating dashboard endpoint sits behind a stateless double-submit
 * CSRF cookie: the server seeds a readable `X-CSRF-Token` cookie on safe
 * requests, and a POST/PATCH/DELETE has to echo it back in a header. Pages
 * were each re-implementing that cookie read inline, which put bare
 * `document.*` access into template scripts and meant a change to the
 * scheme had to be made in every page that writes.
 */

export interface ApiRequestOptions {
  method?: 'GET' | 'HEAD' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  /** Send the stored bearer token when available. Disable for public bearer-link reads. */
  auth?: boolean
  /** JSON request body. Omitted entirely for GET. */
  body?: unknown
  /** Multipart request body. The browser supplies its boundary header. */
  formData?: FormData
  signal?: AbortSignal
}

export class DashboardApiError extends Error {
  readonly status: number
  readonly fields?: Record<string, string>

  constructor(message: string, status: number, fields?: Record<string, string>) {
    super(message)
    this.name = 'DashboardApiError'
    this.status = status
    this.fields = fields
  }
}

/**
 * Call a dashboard API endpoint and return its parsed JSON.
 *
 * Throws on a non-2xx response, using the server's `message` / `error`
 * field when there is one so callers can surface something better than a
 * bare status code.
 */
export async function dashboardApi<T = unknown>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET'
  const headers: Record<string, string> = { accept: 'application/json' }
  const authToken = useAuth().getToken()

  if (options.body !== undefined && options.formData)
    throw new TypeError('dashboardApi accepts either body or formData, not both.')

  if (authToken && options.auth !== false)
    headers.Authorization = `Bearer ${authToken}`

  if (options.body !== undefined)
    headers['content-type'] = 'application/json'

  const requestHeaders = method === 'GET' || method === 'HEAD'
    ? headers
    : withCsrfHeader(headers)

  const res = await fetch(path, {
    method,
    headers: requestHeaders,
    credentials: 'same-origin',
    signal: options.signal,
    ...(options.body !== undefined && { body: JSON.stringify(options.body) }),
    ...(options.formData && { body: options.formData }),
  })

  const text = await res.text()
  let payload: any = null
  try {
    payload = text ? JSON.parse(text) : null
  }
  catch {
    payload = null
  }

  if (!res.ok) {
    const failure = describeResponseError(res.status, payload as ApiErrorBody | null)
    if (failure.unexpected)
      console.error('[dashboard-api] Unexpected request failure:', failure.cause)
    throw new DashboardApiError(failure.message, res.status, failure.fields)
  }

  return payload as T
}
