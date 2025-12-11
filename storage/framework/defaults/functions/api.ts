/**
 * API Client for Dashboard
 *
 * Provides a simple fetch wrapper with authentication and error handling.
 */

import { useAuth } from './auth'

const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3008'

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
  const response = await fetch(`${baseUrl}${endpoint}`, {
    method: 'GET',
    headers: createHeaders(),
  })

  return handleResponse<T>(response)
}

/**
 * POST request
 */
export async function post<T>(endpoint: string, body?: unknown): Promise<T> {
  const response = await fetch(`${baseUrl}${endpoint}`, {
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
  const response = await fetch(`${baseUrl}${endpoint}`, {
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
  const response = await fetch(`${baseUrl}${endpoint}`, {
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
  const response = await fetch(`${baseUrl}${endpoint}`, {
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
