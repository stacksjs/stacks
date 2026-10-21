import { resolveApiBaseUrl } from './api-url'
/**
 * API Client for Dashboard
 *
 * Provides a simple fetch wrapper with authentication and error handling.
 */

import { useAuth } from './auth'

const baseUrl = resolveApiBaseUrl()

/**
 * Where this client is allowed to send a request from.
 *
 * `resolveApiBaseUrl()` answers with the relative `/api` when there is no
 * `window.location` and no injected `__STACKS_API_URL__`, which is the honest
 * answer for a browser bundle and deliberate (stacksjs/stacks#2421). `fetch`
 * cannot use it: off the DOM there is no origin to resolve a relative URL
 * against, so every verb below would reach `ERR_INVALID_URL` after building
 * its headers, reading the auth token and serialising its body.
 *
 * That failure arrived as a bare `TypeError: fetch() URL is invalid` in a dev
 * server log while the page still returned 200, which is how a dashboard
 * template calling `post()` by accident during server-side rendering went
 * unnoticed (stacksjs/stacks#2944). It is also only an accident that nothing
 * was sent: with `__STACKS_API_URL__` injected for a split-origin deployment
 * the URL is absolute, and the same mistake issues a real mutating request
 * while a page renders.
 *
 * So refuse first, by name, before any of that work happens. This client is
 * for the browser; server-side code has the ORM and the actions.
 */
function requestUrl(endpoint: string): string {
  if (/^https?:\/\//i.test(baseUrl))
    return `${baseUrl}${endpoint}`

  throw new DashboardApiEnvironmentError(endpoint)
}

/**
 * Thrown when a dashboard API verb is called where it cannot send a request.
 *
 * Named rather than generic: the thing worth knowing is which endpoint was
 * about to be called from the wrong place, and the stack alone does not say
 * so once the evaluator that called it is several frames of template
 * machinery deep.
 */
export class DashboardApiEnvironmentError extends Error {
  readonly endpoint: string

  constructor(endpoint: string) {
    super(
      `The dashboard API client cannot request "${endpoint}" here: it needs an absolute base URL and resolved "${baseUrl}". `
      + `This client runs in the browser. Server-side code should use the ORM or an action instead.`,
    )
    this.name = 'DashboardApiEnvironmentError'
    this.endpoint = endpoint
  }
}

export interface ApiResponse<T> {
  data: T
  message?: string
}

export interface ApiError {
  message: string
  errors?: Record<string, string[]>
}

/**
 * Create headers with authentication
 */
function createHeaders(contentType = 'application/json'): Headers {
  const { getToken } = useAuth()
  const headers = new Headers({
    'Accept': 'application/json',
    'Content-Type': contentType,
  })

  const token = getToken()
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  return headers
}

/**
 * Handle API response
 */
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({
      message: `HTTP error! status: ${response.status}`,
    }))
    throw new Error(error.message || `HTTP error! status: ${response.status}`)
  }

  return response.json() as Promise<T>
}

/**
 * GET request
 */
export async function get<T>(endpoint: string): Promise<T> {
  const response = await fetch(requestUrl(endpoint), {
    method: 'GET',
    headers: createHeaders(),
  })

  return handleResponse<T>(response)
}

/**
 * POST request
 */
export async function post<T>(endpoint: string, body?: unknown): Promise<T> {
  const response = await fetch(requestUrl(endpoint), {
    method: 'POST',
    headers: createHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  })

  return handleResponse<T>(response)
}

/**
 * PUT request
 */
export async function put<T>(endpoint: string, body?: unknown): Promise<T> {
  const response = await fetch(requestUrl(endpoint), {
    method: 'PUT',
    headers: createHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  })

  return handleResponse<T>(response)
}

/**
 * PATCH request
 */
export async function patch<T>(endpoint: string, body?: unknown): Promise<T> {
  const response = await fetch(requestUrl(endpoint), {
    method: 'PATCH',
    headers: createHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  })

  return handleResponse<T>(response)
}

/**
 * DELETE request
 */
export async function del<T>(endpoint: string): Promise<T> {
  const response = await fetch(requestUrl(endpoint), {
    method: 'DELETE',
    headers: createHeaders(),
  })

  return handleResponse<T>(response)
}

/**
 * Create a typed API resource helper
 */
export function createResource<T>(basePath: string) {
  return {
    list: () => get<ApiResponse<T[]>>(basePath),
    get: (id: string | number) => get<ApiResponse<T>>(`${basePath}/${id}`),
    create: (data: Partial<T>) => post<ApiResponse<T>>(basePath, data),
    update: (id: string | number, data: Partial<T>) => put<ApiResponse<T>>(`${basePath}/${id}`, data),
    patch: (id: string | number, data: Partial<T>) => patch<ApiResponse<T>>(`${basePath}/${id}`, data),
    delete: (id: string | number) => del<ApiResponse<void>>(`${basePath}/${id}`),
  }
}

/**
 * API composable
 */
export function useApi() {
  return {
    get,
    post,
    put,
    patch,
    delete: del,
    createResource,
    baseUrl,
  }
}
