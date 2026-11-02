import type { BodyData, FetcherResponse, FileAttachment, QueryParams } from './types'
import { withQuery } from './query'

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
    for (const [name, value] of Object.entries(headers))
      this.customHeaders[name.toLowerCase()] = value
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
    this.customHeaders.authorization = `Bearer ${token}`
    return this
  }

  withBasicAuth(username: string, password: string): this {
    const credentials = btoa(`${username}:${password}`)
    this.customHeaders.authorization = `Basic ${credentials}`
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

  private getHeaders(): Headers {
    const headers = new Headers(this.defaultHeaders)
    for (const [name, value] of Object.entries(this.customHeaders)) headers.set(name, value)
    return headers
  }

  private addQueryParams(url: string): string {
    if (!this.queryParams) return url
    return withQuery(url, this.queryParams)
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
    this.defaultHeaders = { Accept: 'application/json', 'Content-Type': 'application/json' }
  }

  /** Claim configuration synchronously so overlapping requests cannot share it. */
  private request<T = string>(url: string, method: string, body?: BodyData): Promise<FetcherResponse<T>> {
    const owned = new Fetcher()
    Object.assign(owned, this, {
      defaultHeaders: { ...this.defaultHeaders },
      customHeaders: { ...this.customHeaders },
      attachments: [...this.attachments],
      digestAuth: this.digestAuth ? { ...this.digestAuth } : undefined,
    })
    this.resetState()
    return owned.perform<T>(url, method, body)
  }

  private async perform<T = string>(url: string, method: string, body?: BodyData): Promise<FetcherResponse<T>> {
    const urlWithParams = this.addQueryParams(url)
    const formattedBody = await this.formatBody(body)
    const headers = this.getHeaders()
    if (this.isMultipart) headers.delete('content-type')
    const prepared = new Request(urlWithParams, { method, headers, body: formattedBody })
    let response: Response
    if (this.digestAuth) {
      // Buffer exactly once: multipart boundaries and all body bytes must match
      // the authenticated replay, including auth-int's entity-body digest.
      const bytes = prepared.body ? new Uint8Array(await prepared.arrayBuffer()) : undefined
      // Disable the browser's native HTTP-auth dialog; this client owns the challenge.
      const send = (requestHeaders: Headers) => fetch(prepared.url, { method, headers: requestHeaders, body: bytes, credentials: 'omit' })
      response = await send(prepared.headers)
      const target = new URL(prepared.url)
      target.hash = ''
      const respondedAt = new URL(response.url)
      respondedAt.hash = ''
      if (response.status === 401 && respondedAt.href === target.href) {
        const challenge = response.headers.get('www-authenticate')
        if (challenge) {
          const { digestAuthorization } = await import('./digest')
          const authorization = await digestAuthorization(challenge, this.digestAuth, method, target.href, bytes ?? new Uint8Array())
          if (authorization) {
            await response.body?.cancel()
            const authenticated = new Headers(prepared.headers)
            authenticated.set('authorization', authorization)
            response = await send(authenticated)
          }
        }
      }
    }
    else {
      response = await fetch(prepared)
    }

    const text = await response.text()
    const contentType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ?? ''
    const json = contentType === 'application/json' || contentType.endsWith('+json')
    const data = (text === '' ? null : json ? JSON.parse(text) : text) as T
    this.resetState() // Reset after use

    return new FetcherResponseImpl(
      data,
      response.status,
      response.headers,
      response.ok,
    )
  }

  async get<T = string>(url: string): Promise<FetcherResponse<T>> {
    return this.request<T>(url, 'GET')
  }

  async post<T = string, D extends BodyData = BodyData>(
    url: string,
    body?: D,
  ): Promise<FetcherResponse<T>> {
    return this.request<T>(url, 'POST', body)
  }

  async put<T = string, D extends BodyData = BodyData>(
    url: string,
    body?: D,
  ): Promise<FetcherResponse<T>> {
    return this.request<T>(url, 'PUT', body)
  }

  async patch<T = string, D extends BodyData = BodyData>(
    url: string,
    body?: D,
  ): Promise<FetcherResponse<T>> {
    return this.request<T>(url, 'PATCH', body)
  }

  async delete<T = string>(url: string): Promise<FetcherResponse<T>> {
    return this.request<T>(url, 'DELETE')
  }
}

export const fetcher: Fetcher = new Fetcher()
