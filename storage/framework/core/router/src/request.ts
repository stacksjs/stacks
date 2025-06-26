import type { UserModelType } from '@stacksjs/orm'
import type { AuthToken, CustomAttributes, HttpMethod, NumericField, RequestData, RequestInstance, RouteParam, RouteParams } from '@stacksjs/types'
import { getCurrentUser } from '@stacksjs/auth'
import { customValidate } from '@stacksjs/validation'
import { UploadedFile } from './uploaded-file'

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

export class Request<T extends RequestData = RequestData> implements RequestInstance {
  public query: T = {} as T
  public params: RouteParams = {} as RouteParams
  public headers: any = {}
  public files: Record<string, UploadedFile | UploadedFile[]> = {}

  private sanitizeString(input: string): string {
    // Remove any null bytes
    let sanitized = input.replace(/\0/g, '')

    // Remove any HTML tags
    sanitized = sanitized.replace(/<[^>]*>/g, '')

    // Remove any SQL injection patterns
    sanitized = sanitized.replace(/(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|EXEC|DECLARE)\b)/gi, '')

    // Remove any potential command injection characters
    sanitized = sanitized.replace(/[;&|`$]/g, '')

    // Remove any potential XSS patterns
    sanitized = sanitized.replace(/javascript:/gi, '')
    sanitized = sanitized.replace(/on\w+=/gi, '')

    return sanitized.trim()
  }

  private sanitizeValue(value: any): any {
    if (typeof value === 'string')
      return this.sanitizeString(value)

    if (Array.isArray(value))
      return value.map(item => this.sanitizeValue(item))

    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(([k, v]) => [this.sanitizeString(k), this.sanitizeValue(v)]),
      )
    }

    return value
  }

  public addQuery(url: URL): void {
    const sanitizedQuery: Record<string, any> = {}
    for (const [key, value] of url.searchParams) {
      const sanitizedKey = this.sanitizeString(key.trim())
      const sanitizedValue = this.sanitizeValue(value)
      sanitizedQuery[sanitizedKey] = sanitizedValue
    }
    this.query = sanitizedQuery as unknown as T
  }

  public addBodies(params: any): void {
    this.query = this.sanitizeValue(params)
  }

  public addParam(param: RouteParam): void {
    this.params = this.sanitizeValue(param)
  }

  public addHeaders(headerParams: Headers): void {
    this.headers = headerParams
  }

  public addFiles(files: Record<string, File | File[]>): void {
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
   * This is the main method you'll use to populate files from HTTP requests
   */
  public async addFilesFromFormData(formData: FormData): Promise<void> {
    const files: Record<string, File | File[]> = {}

    for (const [key, value] of formData.entries()) {
      if (value && typeof value === 'object' && 'name' in value && 'size' in value) {
        // Handle single file
        if (key in files) {
          // Convert to array if multiple files with same key
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
   * Convenience method to create a Request from FormData
   * This is the easiest way to get started
   */
  public static async fromFormData(formData: FormData): Promise<Request> {
    const request = new Request()
    await request.addFilesFromFormData(formData)
    return request
  }

  public get<T = string>(element: string, defaultValue?: T): T {
    const value = this.query[element]

    if (!value)
      return defaultValue as T

    // If the value is already the expected type, return it
    if (typeof value === typeof defaultValue)
      return value as T

    // Try to parse string values that might be JSON
    if (typeof value === 'string') {
      const trimmedValue = value.trim()
      try {
        return JSON.parse(trimmedValue) as T
      }
      catch {
        return trimmedValue as T
      }
    }

    return value as T
  }

  public all(): T {
    return this.query
  }

  public async validate(attributes?: CustomAttributes): Promise<void> {
    if (attributes)
      await customValidate(attributes, this.all())
  }

  public has(element: string): boolean {
    return element in this.query
  }

  public isEmpty(): boolean {
    return Object.keys(this.query).length === 0
  }

  public extractParamsFromRoute(routePattern: string, pathname: string): void {
    const pattern = new RegExp(`^${routePattern.replace(/:(\w+)/g, (match, paramName) => `(?<${paramName}>\\w+)`)}$`)
    const match = pattern.exec(pathname)

    if (match?.groups)
      this.params = match.groups
  }

  public header(headerParam: string): string | number | boolean | null {
    return this.headers.get(headerParam)
  }

  public getHeaders(): any {
    return this.headers
  }

  public Header(headerParam: string): string | number | boolean | null {
    return this.headers.get(headerParam)
  }

  public getParam<K extends string>(key: K): K extends NumericField ? number : string {
    const value = this.params[key]

    if (numericFields.has(key as NumericField)) {
      const numValue = Number(value)
      return (Number.isNaN(numValue) ? 0 : numValue) as K extends NumericField ? number : string
    }

    return value as K extends NumericField ? number : string
  }

  public route(key: string): number | string | null {
    return this.getParam(key)
  }

  public bearerToken(): string | null | AuthToken {
    const authorizationHeader = this.headers.get('authorization')

    if (authorizationHeader?.startsWith('Bearer ')) {
      return authorizationHeader.substring(7)
    }

    return null
  }

  public getParams(): RouteParams {
    return this.params
  }

  public getParamAsInt(key: string): number | null {
    const value = this.getParam(key)
    return value ? Number.parseInt(value.toString()) : null
  }

  public browser(): string | null {
    return this.headers.get('user-agent')
  }

  public ip(): string | null {
    return this.ipForRateLimit()
  }

  public ipForRateLimit(): string | null {
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
        // Return the first IP from the header
        return ip.split(',')[0].trim()
      }
    }

    return null
  }

  public getMethod(): HttpMethod {
    const method = this.headers.get('x-http-method-override')
      || this.headers.get('x-method-override')
      || this.headers.get('x-requested-with')
      || this.headers.get('method')
      || 'GET'

    return method.toUpperCase() as HttpMethod
  }

  public async user(): Promise<UserModelType | undefined> {
    return await getCurrentUser()
  }

  public file(key: string): UploadedFile | null {
    const fileOrFiles = this.files[key]

    if (!fileOrFiles) {
      return null
    }

    if (Array.isArray(fileOrFiles)) {
      return fileOrFiles[0] || null
    }

    return fileOrFiles
  }

  public getFiles(key: string): UploadedFile[] {
    const fileOrFiles = this.files[key]

    if (!fileOrFiles) {
      return []
    }

    if (Array.isArray(fileOrFiles)) {
      return fileOrFiles
    }

    return [fileOrFiles]
  }

  public hasFile(key: string): boolean {
    return key in this.files
  }

  public allFiles(): Record<string, UploadedFile | UploadedFile[]> {
    return this.files
  }
}

export const request: Request = new Request()
