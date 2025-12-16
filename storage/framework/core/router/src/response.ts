/**
 * Response Factory
 *
 * Provides fluent response helpers for Stacks actions.
 * This mirrors the bun-router response factory API.
 */

/**
 * JSON response options
 */
export interface JsonResponseOptions {
  status?: number
  headers?: Record<string, string>
  pretty?: boolean
}

/**
 * Response factory with common response helpers
 */
export const response = {
  /**
   * Create a JSON response
   */
  json: <T>(data: T, options: JsonResponseOptions = {}): Response => {
    const { status = 200, headers = {}, pretty = false } = options
    const body = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data)

    return new Response(body, {
      status,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    })
  },

  /**
   * Create a 204 No Content response
   */
  noContent: (headers: Record<string, string> = {}): Response => {
    return new Response(null, {
      status: 204,
      headers,
    })
  },

  /**
   * Create a 201 Created response
   */
  created: <T>(data: T, options: JsonResponseOptions = {}): Response => {
    return response.json(data, { ...options, status: 201 })
  },

  /**
   * Create a 400 Bad Request response
   */
  badRequest: <T>(data: T, options: JsonResponseOptions = {}): Response => {
    return response.json(data, { ...options, status: 400 })
  },

  /**
   * Create a 401 Unauthorized response
   */
  unauthorized: <T>(data: T = { error: 'Unauthorized' } as T, options: JsonResponseOptions = {}): Response => {
    return response.json(data, { ...options, status: 401 })
  },

  /**
   * Create a 403 Forbidden response
   */
  forbidden: <T>(data: T = { error: 'Forbidden' } as T, options: JsonResponseOptions = {}): Response => {
    return response.json(data, { ...options, status: 403 })
  },

  /**
   * Create a 404 Not Found response
   */
  notFound: <T>(data: T = { error: 'Not Found' } as T, options: JsonResponseOptions = {}): Response => {
    return response.json(data, { ...options, status: 404 })
  },

  /**
   * Create a 500 Internal Server Error response
   */
  error: <T>(data: T = { error: 'Internal Server Error' } as T, options: JsonResponseOptions = {}): Response => {
    return response.json(data, { ...options, status: 500 })
  },

  /**
   * Create a redirect response
   */
  redirect: (url: string, status: 301 | 302 | 303 | 307 | 308 = 302): Response => {
    return new Response(null, {
      status,
      headers: { Location: url },
    })
  },

  /**
   * Create a text response
   */
  text: (text: string, options: { status?: number, headers?: Record<string, string> } = {}): Response => {
    const { status = 200, headers = {} } = options
    return new Response(text, {
      status,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        ...headers,
      },
    })
  },

  /**
   * Create an HTML response
   */
  html: (html: string, options: { status?: number, headers?: Record<string, string> } = {}): Response => {
    const { status = 200, headers = {} } = options
    return new Response(html, {
      status,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        ...headers,
      },
    })
  },
}
