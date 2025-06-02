import type { FetcherResponse, QueryParams, BodyData } from './types'

class FetcherResponseImpl<T> implements FetcherResponse<T> {
  constructor(
    public data: T,
    public status: number,
    public headers: Headers,
    public isOk: boolean,
  ) {}

  // 2xx Success
  ok(): boolean { return this.status === 200 }
  created(): boolean { return this.status === 201 }
  accepted(): boolean { return this.status === 202 }
  noContent(): boolean { return this.status === 204 }

  // 3xx Redirection
  movedPermanently(): boolean { return this.status === 301 }
  found(): boolean { return this.status === 302 }

  // 4xx Client Errors
  badRequest(): boolean { return this.status === 400 }
  unauthorized(): boolean { return this.status === 401 }
  paymentRequired(): boolean { return this.status === 402 }
  forbidden(): boolean { return this.status === 403 }
  notFound(): boolean { return this.status === 404 }
  requestTimeout(): boolean { return this.status === 408 }
  conflict(): boolean { return this.status === 409 }
  unprocessableEntity(): boolean { return this.status === 422 }
  tooManyRequests(): boolean { return this.status === 429 }

  // 5xx Server Errors
  serverError(): boolean { return this.status === 500 }
}

class Fetcher {
  private defaultHeaders = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  }

  private queryParams?: QueryParams

  withQueryParams(params: QueryParams): this {
    this.queryParams = params
    return this
  }

  private addQueryParams(url: string): string {
    if (!this.queryParams) return url

    const searchParams = new URLSearchParams()
    Object.entries(this.queryParams).forEach(([key, value]) => {
      if (value != null) searchParams.append(key, String(value))
    })

    const queryString = searchParams.toString()
    if (!queryString) return url

    const hasParams = url.includes('?')
    return url + (hasParams ? '&' : '?') + queryString
  }

  private async request<T>(url: string, method: string, body?: any): Promise<FetcherResponse<T>> {
    const urlWithParams = this.addQueryParams(url)

    const response = await fetch(urlWithParams, {
      method,
      headers: this.defaultHeaders,
      body: body ? JSON.stringify(body) : undefined,
    })

    const data = await response.json() as T
    this.queryParams = undefined // Reset after use

    return new FetcherResponseImpl(
      data,
      response.status,
      response.headers,
      response.ok,
    )
  }

  async get<T = any>(url: string): Promise<FetcherResponse<T>> {
    return this.request<T>(url, 'GET')
  }

  async post<T = any, D extends BodyData = BodyData>(
    url: string, 
    body?: D
  ): Promise<FetcherResponse<T>> {
    return this.request<T>(url, 'POST', body)
  }

  async put<T = any, D extends BodyData = BodyData>(
    url: string,
    body?: D
  ): Promise<FetcherResponse<T>> {
    return this.request<T>(url, 'PUT', body)
  }

  async patch<T = any, D extends BodyData = BodyData>(
    url: string,
    body?: D
  ): Promise<FetcherResponse<T>> {
    return this.request<T>(url, 'PATCH', body)
  }

  async delete<T = any>(url: string): Promise<FetcherResponse<T>> {
    return this.request<T>(url, 'DELETE')
  }
}

export const fetcher: Fetcher = new Fetcher()

