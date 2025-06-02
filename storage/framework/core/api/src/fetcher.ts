import type { BodyData, FetcherResponse, FileAttachment, QueryParams } from './types'

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
  private defaultHeaders: Record<string, string> = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  }

  private queryParams?: QueryParams
  private bodyData?: BodyData
  private isFormData: boolean = false
  private customHeaders: Record<string, string> = {}
  private attachments: FileAttachment[] = []
  private isMultipart: boolean = false
  private digestAuth?: {
    username: string
    password: string
  }

  withQueryParams(params: QueryParams): this {
    this.queryParams = params
    return this
  }

  withHeaders(headers: Record<string, string>): this {
    this.customHeaders = { ...this.customHeaders, ...headers }
    return this
  }

  accept(contentType: string): this {
    this.defaultHeaders.Accept = contentType
    return this
  }

  acceptJson(): this {
    return this.accept('application/json')
  }

  withToken(token: string): this {
    this.customHeaders.Authorization = `Bearer ${token}`
    return this
  }

  withBasicAuth(username: string, password: string): this {
    const credentials = btoa(`${username}:${password}`)
    this.customHeaders.Authorization = `Basic ${credentials}`
    return this
  }

  withDigestAuth(username: string, password: string): this {
    // Store credentials for the digest auth flow
    this.digestAuth = { username, password }
    return this
  }

  withBody<D extends BodyData>(data: D): this {
    this.bodyData = data
    return this
  }

  asForm(): this {
    this.isFormData = true
    this.defaultHeaders['Content-Type'] = 'application/x-www-form-urlencoded'
    return this
  }

  attach(
    name: string,
    content: string | Blob | File,
    filename?: string,
    headers?: Record<string, string>,
  ): this {
    // Convert content to Blob if it's a string
    const blobContent = typeof content === 'string'
      ? new Blob([content], { type: headers?.['Content-Type'] || 'text/plain' })
      : content

    this.attachments.push({
      name,
      content: blobContent,
      filename,
      headers,
    })

    this.isMultipart = true
    delete this.defaultHeaders['Content-Type'] // Let browser set the correct boundary
    return this
  }

  private getHeaders(): Record<string, string> {
    return {
      ...this.defaultHeaders,
      ...this.customHeaders,
    }
  }

  private addQueryParams(url: string): string {
    if (!this.queryParams)
      return url

    const searchParams = new URLSearchParams()
    Object.entries(this.queryParams).forEach(([key, value]) => {
      if (value != null)
        searchParams.append(key, String(value))
    })

    const queryString = searchParams.toString()
    if (!queryString)
      return url

    const hasParams = url.includes('?')
    return url + (hasParams ? '&' : '?') + queryString
  }

  private async formatBody(body?: BodyData): Promise<string | FormData | undefined> {
    const finalBody = body || this.bodyData

    if (this.isMultipart) {
      const formData = new FormData()

      // Add any regular body fields
      if (finalBody) {
        Object.entries(finalBody).forEach(([key, value]) => {
          formData.append(key, String(value))
        })
      }

      // Add file attachments
      for (const attachment of this.attachments) {
        if (attachment.headers) {
          // If we have custom headers for the file, we need to use a Blob with type
          const blob = attachment.content instanceof Blob
            ? new Blob([attachment.content], { type: attachment.headers['Content-Type'] })
            : attachment.content

          formData.append(attachment.name, blob, attachment.filename)
        }
        else {
          formData.append(attachment.name, attachment.content, attachment.filename)
        }
      }

      return formData
    }

    if (this.isFormData && finalBody) {
      const formData = new URLSearchParams()
      Object.entries(finalBody).forEach(([key, value]) => {
        if (value != null)
          formData.append(key, String(value))
      })
      return formData.toString()
    }

    return finalBody ? JSON.stringify(finalBody) : undefined
  }

  private resetState(): void {
    this.queryParams = undefined
    this.bodyData = undefined
    this.isFormData = false
    this.isMultipart = false
    this.customHeaders = {}
    this.attachments = []
    this.digestAuth = undefined
    this.defaultHeaders['Content-Type'] = 'application/json'
  }

  private async handleDigestAuth(
    response: Response,
    url: string,
    method: string,
    body?: BodyData,
  ): Promise<Response> {
    if (response.status !== 401 || !this.digestAuth)
      return response

    const authHeader = response.headers.get('WWW-Authenticate')
    if (!authHeader?.startsWith('Digest '))
      return response

    // Parse the digest challenge
    const challenge = authHeader.substring(7).split(',').reduce((acc, part) => {
      const [key, value] = part.trim().split('=')
      acc[key] = value?.replace(/["']/g, '') // Remove quotes
      return acc
    }, {} as Record<string, string>)

    // Generate digest response
    const ha1 = await this.generateMD5(
      `${this.digestAuth.username}:${challenge.realm}:${this.digestAuth.password}`,
    )
    const ha2 = await this.generateMD5(`${method}:${url}`)
    const nonceCount = '00000001'
    const cnonce = await this.generateMD5(Date.now().toString()).then(hash => hash.substring(0, 8))
    const response_value = await this.generateMD5(
      `${ha1}:${challenge.nonce}:${nonceCount}:${cnonce}:${challenge.qop}:${ha2}`,
    )

    const digestResponse = {
      username: `"${this.digestAuth.username}"`,
      realm: `"${challenge.realm}"`,
      nonce: `"${challenge.nonce}"`,
      uri: `"${url}"`,
      algorithm: challenge.algorithm ? `"${challenge.algorithm}"` : undefined,
      qop: `"${challenge.qop}"`,
      nc: nonceCount,
      cnonce: `"${cnonce}"`,
      response: `"${response_value}"`,
      opaque: challenge.opaque ? `"${challenge.opaque}"` : undefined,
    }

    // Build the Authorization header
    const authValue = Object.entries(digestResponse)
      .filter(([_, value]) => value !== undefined)
      .map(([key, value]) => `${key}=${value}`)
      .join(', ')

    this.customHeaders.Authorization = `Digest ${authValue}`

    // Retry the request with digest credentials
    return fetch(url, {
      method,
      headers: this.getHeaders(),
      body: body ? this.formatBody(body) as any : undefined,
    })
  }

  private async generateMD5(str: string): Promise<string> {
    const encoder = new TextEncoder()
    const data = encoder.encode(str)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  private async request<T>(url: string, method: string, body?: BodyData): Promise<FetcherResponse<T>> {
    const urlWithParams = this.addQueryParams(url)
    const formattedBody = await this.formatBody(body)

    let response = await fetch(urlWithParams, {
      method,
      headers: this.getHeaders(),
      body: formattedBody as any,
    })

    // Handle digest authentication if needed
    if (this.digestAuth) {
      response = await this.handleDigestAuth(response, urlWithParams, method, body)
    }

    const data = await response.json() as T
    this.resetState() // Reset after use

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
    body?: D,
  ): Promise<FetcherResponse<T>> {
    return this.request<T>(url, 'POST', body)
  }

  async put<T = any, D extends BodyData = BodyData>(
    url: string,
    body?: D,
  ): Promise<FetcherResponse<T>> {
    return this.request<T>(url, 'PUT', body)
  }

  async patch<T = any, D extends BodyData = BodyData>(
    url: string,
    body?: D,
  ): Promise<FetcherResponse<T>> {
    return this.request<T>(url, 'PATCH', body)
  }

  async delete<T = any>(url: string): Promise<FetcherResponse<T>> {
    return this.request<T>(url, 'DELETE')
  }
}

export const fetcher: Fetcher = new Fetcher()
