import type { FetcherResponse, QueryParams, BodyData } from './types'

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

  async get<T = any>(url: string): Promise<FetcherResponse<T>> {
    const urlWithParams = this.addQueryParams(url)
    
    const response = await fetch(urlWithParams, {
      method: 'GET',
      headers: this.defaultHeaders,
    })

    const data = await response.json() as T
    this.queryParams = undefined // Reset after use

    return {
      data,
      status: response.status,
      headers: response.headers,
      ok: response.ok,
    }
  }

  async post<T = any, D extends BodyData = BodyData>(
    url: string, 
    body?: D
  ): Promise<FetcherResponse<T>> {
    const urlWithParams = this.addQueryParams(url)

    const response = await fetch(urlWithParams, {
      method: 'POST',
      headers: this.defaultHeaders,
      body: body ? JSON.stringify(body) : undefined,
    })

    const data = await response.json() as T
    this.queryParams = undefined // Reset after use

    return {
      data,
      status: response.status,
      headers: response.headers,
      ok: response.ok,
    }
  }
}

export const fetcher: Fetcher = new Fetcher()

