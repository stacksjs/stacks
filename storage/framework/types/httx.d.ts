declare module '@stacksjs/httx' {
  export interface RequestOptions {
    method?: string
    headers?: Record<string, string>
    body?: unknown
    json?: boolean
    timeout?: number
  }

  export interface RequestResult {
    isOk: boolean
    value: {
      data: unknown
      status: number
      statusText: string
      headers: Record<string, string>
      timings: { duration: number, [key: string]: unknown }
    }
    error: { message: string, [key: string]: unknown }
  }

  export class HttxClient {
    constructor(options?: { baseUrl?: string, headers?: Record<string, string>, verbose?: boolean })
    request(url: string, options?: RequestOptions): Promise<RequestResult>
    get(url: string, options?: RequestOptions): Promise<RequestResult>
    post(url: string, options?: RequestOptions): Promise<RequestResult>
    put(url: string, options?: RequestOptions): Promise<RequestResult>
    patch(url: string, options?: RequestOptions): Promise<RequestResult>
    delete(url: string, options?: RequestOptions): Promise<RequestResult>
  }

  export const config: Record<string, unknown>
  export const HTTP_METHODS: string[]
}
