/**
 * The response shape from any Fetcher request
 * @template T The type of data expected in the response
 */
interface FetcherResponse<T = any> {
  data: T
  status: number
  headers: Headers
  ok: boolean
}

/**
 * A simple, powerful HTTP client that wraps the fetch API
 * with a more elegant interface and better TypeScript support.
 */
class Fetcher {
  private static defaultHeaders = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  }

  /**
   * Make a GET request
   * @template T The expected response data type
   * @example
   * // Simple usage
   * const response = await fetcher.get('/users')
   * 
   * // With type safety
   * interface User {
   *   id: number
   *   name: string
   * }
   * const users = await fetcher.get<User[]>('/users')
   * const user = await fetcher.get<User>('/users/1')
   */
  static async get<T = any>(url: string): Promise<FetcherResponse<T>> {
    const response = await fetch(url, {
      method: 'GET',
      headers: this.defaultHeaders,
    })

    const data = await response.json() as T

    return {
      data,
      status: response.status,
      headers: response.headers,
      ok: response.ok,
    }
  }

  /**
   * Make a POST request
   * @template T The expected response data type
   * @template D The type of data being sent (optional)
   * @example
   * // Simple usage
   * const response = await fetcher.post('/users', { name: 'John' })
   * 
   * // With type safety for both request and response
   * interface CreateUserRequest {
   *   name: string
   *   email: string
   * }
   * interface User extends CreateUserRequest {
   *   id: number
   * }
   * const user = await fetcher.post<User, CreateUserRequest>('/users', {
   *   name: 'John',
   *   email: 'john@example.com'
   * })
   */
  static async post<T = any, D = any>(url: string, data?: D): Promise<FetcherResponse<T>> {
    const response = await fetch(url, {
      method: 'POST',
      headers: this.defaultHeaders,
      body: data ? JSON.stringify(data) : undefined,
    })

    const responseData = await response.json() as T

    return {
      data: responseData,
      status: response.status,
      headers: response.headers,
      ok: response.ok,
    }
  }
}

// Export a default instance
export const fetcher: Fetcher = new Fetcher()

