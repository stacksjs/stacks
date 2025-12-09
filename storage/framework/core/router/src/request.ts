import type { UserModelType } from '@stacksjs/orm'
import type { AuthToken, CustomAttributes, HttpMethod, NumericField, RequestData, RequestInstance, RouteParam, RouteParams } from '@stacksjs/types'
import type { EnhancedRequest as BunEnhancedRequest } from 'bun-router'
import { getCurrentUser } from '@stacksjs/auth'
import { customValidate } from '@stacksjs/validation'
import { UploadedFile } from './uploaded-file'

/**
 * Set of fields that should be automatically cast to numbers
 */
const numericFields = new Set<NumericField>([
  'id',
  'age',
  'count',
  'quantity',
  'amount',
  'price',
  'total',
  'score',
  'rating',
  'duration',
  'size',
  'weight',
  'height',
  'width',
  'length',
  'distance',
  'speed',
  'temperature',
  'volume',
  'capacity',
  'density',
  'pressure',
  'force',
  'energy',
  'power',
  'frequency',
  'voltage',
  'current',
  'resistance',
  'time',
  'date',
  'year',
  'month',
  'day',
  'hour',
  'minute',
  'second',
  'millisecond',
  'microsecond',
  'nanosecond',
])

/**
 * Stacks Request class - extends functionality for Stacks framework
 *
 * This class provides:
 * - Input sanitization (SQL injection, XSS, command injection protection)
 * - File upload handling via UploadedFile class
 * - Type-safe parameter extraction
 * - Integration with bun-router's EnhancedRequest
 * - Authentication and validation helpers
 */
export class Request<T extends RequestData = RequestData> implements RequestInstance {
  /** Query parameters and body data */
  public query: T = {} as T

  /** Route parameters (e.g., /users/{id} -> { id: '123' }) */
  public params: RouteParams = {} as RouteParams

  /** Request headers */
  public headers: Headers = new Headers()

  /** Uploaded files */
  public files: Record<string, UploadedFile | UploadedFile[]> = {}

  /** Reference to original bun-router EnhancedRequest if available */
  private _bunRequest?: BunEnhancedRequest

  // ============================================================================
  // INPUT SANITIZATION
  // ============================================================================

  /**
   * Sanitize a string value to prevent injection attacks
   *
   * Protects against:
   * - Null byte injection
   * - HTML/Script injection (XSS)
   * - SQL injection patterns
   * - Command injection characters
   */
  private sanitizeString(input: string): string {
    // Remove null bytes
    let sanitized = input.replace(/\0/g, '')

    // Remove HTML tags
    sanitized = sanitized.replace(/<[^>]*>/g, '')

    // Remove SQL injection patterns
    sanitized = sanitized.replace(/(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|EXEC|DECLARE)\b)/gi, '')

    // Remove command injection characters
    sanitized = sanitized.replace(/[;&|`$]/g, '')

    // Remove XSS patterns
    sanitized = sanitized.replace(/javascript:/gi, '')
    sanitized = sanitized.replace(/on\w+=/gi, '')

    return sanitized.trim()
  }

  /**
   * Recursively sanitize any value (string, array, or object)
   */
  private sanitizeValue(value: any): any {
    if (typeof value === 'string') {
      return this.sanitizeString(value)
    }

    if (Array.isArray(value)) {
      return value.map(item => this.sanitizeValue(item))
    }

    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(([k, v]) => [this.sanitizeString(k), this.sanitizeValue(v)]),
      )
    }

    return value
  }

  // ============================================================================
  // DATA POPULATION
  // ============================================================================

  /**
   * Add query parameters from a URL
   */
  addQuery(url: URL): void {
    const sanitizedQuery: Record<string, any> = {}
    for (const [key, value] of url.searchParams) {
      const sanitizedKey = this.sanitizeString(key.trim())
      const sanitizedValue = this.sanitizeValue(value)
      sanitizedQuery[sanitizedKey] = sanitizedValue
    }
    this.query = sanitizedQuery as unknown as T
  }

  /**
   * Add body parameters (from JSON, form data, etc.)
   */
  addBodies(params: any): void {
    this.query = this.sanitizeValue(params)
  }

  /**
   * Add route parameters
   */
  addParam(param: RouteParam): void {
    this.params = this.sanitizeValue(param)
  }

  /**
   * Add request headers
   */
  addHeaders(headerParams: Headers): void {
    this.headers = headerParams
  }

  /**
   * Add files from a raw files object
   */
  addFiles(files: Record<string, File | File[]>): void {
    for (const [key, fileOrFiles] of Object.entries(files)) {
      if (Array.isArray(fileOrFiles)) {
        this.files[key] = fileOrFiles.map(file => new UploadedFile(file))
      }
      else {
        this.files[key] = new UploadedFile(fileOrFiles)
      }
    }
  }

  /**
   * Extract files from FormData and add them to the request
   */
  async addFilesFromFormData(formData: FormData): Promise<void> {
    const files: Record<string, File | File[]> = {}

    for (const [key, value] of formData.entries()) {
      if (value && typeof value === 'object' && 'name' in value && 'size' in value) {
        if (key in files) {
          const existing = files[key]
          if (Array.isArray(existing)) {
            existing.push(value as File)
          }
          else {
            files[key] = [existing, value as File]
          }
        }
        else {
          files[key] = value as File
        }
      }
    }

    this.addFiles(files)
  }

  /**
   * Create a Request instance from a bun-router EnhancedRequest
   */
  static fromEnhancedRequest<T extends RequestData = RequestData>(bunRequest: BunEnhancedRequest): Request<T> {
    const request = new Request<T>()
    request._bunRequest = bunRequest

    // Copy params
    if (bunRequest.params) {
      request.params = bunRequest.params as RouteParams
    }

    // Copy query
    if (bunRequest.query) {
      request.query = bunRequest.query as unknown as T
    }

    // Copy headers
    request.headers = bunRequest.headers

    // Copy files if available
    if (bunRequest.files) {
      for (const file of bunRequest.files) {
        const key = file.name
        if (key in request.files) {
          const existing = request.files[key]
          if (Array.isArray(existing)) {
            existing.push(new UploadedFile(file))
          }
          else {
            request.files[key] = [existing, new UploadedFile(file)]
          }
        }
        else {
          request.files[key] = new UploadedFile(file)
        }
      }
    }

    return request
  }

  /**
   * Create a Request instance from FormData
   */
  static async fromFormData<T extends RequestData = RequestData>(formData: FormData): Promise<Request<T>> {
    const request = new Request<T>()
    await request.addFilesFromFormData(formData)
    return request
  }

  // ============================================================================
  // DATA ACCESS
  // ============================================================================

  /**
   * Get a query parameter with optional default value and type coercion
   */
  get<V = string>(element: string, defaultValue?: V): V {
    const value = this.query[element]

    if (value === undefined || value === null) {
      return defaultValue as V
    }

    // If the value is already the expected type, return it
    if (typeof value === typeof defaultValue) {
      return value as V
    }

    // Try to parse string values that might be JSON
    if (typeof value === 'string') {
      const trimmedValue = value.trim()
      try {
        return JSON.parse(trimmedValue) as V
      }
      catch {
        return trimmedValue as V
      }
    }

    return value as V
  }

  /**
   * Get all query/body data
   */
  all(): T {
    return this.query
  }

  /**
   * Validate the request data against custom attributes
   */
  async validate(attributes?: CustomAttributes): Promise<void> {
    if (attributes) {
      await customValidate(attributes, this.all())
    }
  }

  /**
   * Check if a parameter exists in the request
   */
  has(element: string): boolean {
    return element in this.query
  }

  /**
   * Check if the request has no data
   */
  isEmpty(): boolean {
    return Object.keys(this.query).length === 0
  }

  // ============================================================================
  // ROUTE PARAMETERS
  // ============================================================================

  /**
   * Extract route parameters from a route pattern and pathname
   */
  extractParamsFromRoute(routePattern: string, pathname: string): void {
    const pattern = new RegExp(`^${routePattern.replace(/:(\w+)/g, (_match, paramName) => `(?<${paramName}>\\w+)`)}$`)
    const match = pattern.exec(pathname)

    if (match?.groups) {
      this.params = match.groups as RouteParams
    }
  }

  /**
   * Get a route parameter with automatic type casting for numeric fields
   */
  getParam<K extends string>(key: K): K extends NumericField ? number : string {
    const value = this.params[key]

    if (numericFields.has(key as NumericField)) {
      const numValue = Number(value)
      return (Number.isNaN(numValue) ? 0 : numValue) as K extends NumericField ? number : string
    }

    return value as K extends NumericField ? number : string
  }

  /**
   * Alias for getParam - Laravel-style route parameter access
   */
  route(key: string): number | string | null {
    return this.getParam(key)
  }

  /**
   * Get all route parameters
   */
  getParams(): RouteParams {
    return this.params
  }

  /**
   * Get a route parameter as an integer
   */
  getParamAsInt(key: string): number | null {
    const value = this.getParam(key)
    return value ? Number.parseInt(value.toString()) : null
  }

  // ============================================================================
  // HEADERS
  // ============================================================================

  /**
   * Get a header value
   */
  header(headerParam: string): string | null {
    return this.headers.get(headerParam)
  }

  /**
   * Alias for header (capitalized)
   */
  Header(headerParam: string): string | null {
    return this.headers.get(headerParam)
  }

  /**
   * Get all headers
   */
  getHeaders(): Headers {
    return this.headers
  }

  /**
   * Extract Bearer token from Authorization header
   */
  bearerToken(): string | null | AuthToken {
    const authorizationHeader = this.headers.get('authorization')

    if (authorizationHeader?.startsWith('Bearer ')) {
      return authorizationHeader.substring(7)
    }

    return null
  }

  // ============================================================================
  // CLIENT INFORMATION
  // ============================================================================

  /**
   * Get the User-Agent header
   */
  browser(): string | null {
    return this.headers.get('user-agent')
  }

  /**
   * Get the client IP address
   */
  ip(): string | null {
    return this.ipForRateLimit()
  }

  /**
   * Get the client IP address for rate limiting
   * Checks multiple headers in priority order for various proxy configurations
   */
  ipForRateLimit(): string | null {
    // Order of headers to check (from most to least reliable)
    const ipHeaders = [
      'cf-connecting-ip', // Cloudflare
      'x-real-ip', // Nginx
      'x-client-ip', // Apache
      'x-forwarded-for', // Standard proxy header
      'x-forwarded', // Alternative proxy header
      'forwarded-for', // Standard proxy header
      'forwarded', // Standard proxy header
      'x-appengine-user-ip', // Google App Engine
      'x-cluster-client-ip', // Rackspace LB
      'x-azure-clientip', // Azure
      'x-aws-via', // AWS
      'true-client-ip', // Akamai
      'fastly-client-ip', // Fastly
      'x-vercel-forwarded-for', // Vercel
      'x-netlify-ip', // Netlify
    ]

    for (const header of ipHeaders) {
      const ip = this.headers.get(header)
      if (ip) {
        // Return the first IP from the header (for x-forwarded-for with multiple IPs)
        return ip.split(',')[0].trim()
      }
    }

    return null
  }

  /**
   * Get the HTTP method (with override support)
   */
  getMethod(): HttpMethod {
    const method = this.headers.get('x-http-method-override')
      || this.headers.get('x-method-override')
      || this.headers.get('x-requested-with')
      || this.headers.get('method')
      || 'GET'

    return method.toUpperCase() as HttpMethod
  }

  // ============================================================================
  // AUTHENTICATION
  // ============================================================================

  /**
   * Get the currently authenticated user
   */
  async user(): Promise<UserModelType | undefined> {
    return await getCurrentUser()
  }

  // ============================================================================
  // FILE HANDLING
  // ============================================================================

  /**
   * Get a single uploaded file by key
   */
  file(key: string): UploadedFile | null {
    const fileOrFiles = this.files[key]

    if (!fileOrFiles) {
      return null
    }

    if (Array.isArray(fileOrFiles)) {
      return fileOrFiles[0] || null
    }

    return fileOrFiles
  }

  /**
   * Get all uploaded files for a key (always returns array)
   */
  getFiles(key: string): UploadedFile[] {
    const fileOrFiles = this.files[key]

    if (!fileOrFiles) {
      return []
    }

    if (Array.isArray(fileOrFiles)) {
      return fileOrFiles
    }

    return [fileOrFiles]
  }

  /**
   * Check if a file was uploaded for the given key
   */
  hasFile(key: string): boolean {
    return key in this.files
  }

  /**
   * Get all uploaded files
   */
  allFiles(): Record<string, UploadedFile | UploadedFile[]> {
    return this.files
  }

  // ============================================================================
  // BUN-ROUTER INTEGRATION
  // ============================================================================

  /**
   * Get the original bun-router EnhancedRequest if available
   */
  getBunRequest(): BunEnhancedRequest | undefined {
    return this._bunRequest
  }

  /**
   * Access bun-router's session data if available
   */
  session<S = any>(): S | undefined {
    return this._bunRequest?.session as S | undefined
  }

  /**
   * Access bun-router's validated data if available
   */
  validated<V = any>(): V | undefined {
    return this._bunRequest?.validated as V | undefined
  }

  /**
   * Get request context from bun-router
   */
  context<C = any>(): C | undefined {
    return this._bunRequest?.context as C | undefined
  }

  /**
   * Get rate limit remaining from bun-router
   */
  rateLimitRemaining(): number | undefined {
    return this._bunRequest?.rateLimitRemaining
  }

  /**
   * Get request ID from bun-router
   */
  requestId(): string | undefined {
    return this._bunRequest?.requestId
  }

  /**
   * Get CSRF token from bun-router
   */
  csrfToken(): string | undefined {
    return this._bunRequest?.csrfToken
  }
}

/**
 * Singleton request instance for simple use cases
 */
export const request: Request = new Request()

/**
 * Type alias for the Request class
 */
export type StacksRequest<T extends RequestData = RequestData> = Request<T>
