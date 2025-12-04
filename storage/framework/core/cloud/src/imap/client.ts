/**
 * AWS API Client - Direct API calls without AWS CLI
 * Implements AWS Signature Version 4 for authentication
 */

import * as crypto from 'node:crypto'
import { XMLParser } from 'fast-xml-parser'

export interface AWSCredentials {
  accessKeyId: string
  secretAccessKey: string
  sessionToken?: string
}

export interface AWSRequestOptions {
  service: string
  region: string
  method: string
  path: string
  queryParams?: Record<string, string>
  headers?: Record<string, string>
  body?: string
  credentials?: AWSCredentials
  retries?: number
  cacheKey?: string
  cacheTTL?: number
  returnHeaders?: boolean
  rawResponse?: boolean
}

export interface AWSClientConfig {
  maxRetries?: number
  retryDelay?: number
  cacheEnabled?: boolean
  defaultCacheTTL?: number
}

export interface AWSError extends Error {
  code?: string
  statusCode?: number
  requestId?: string
  type?: string
}

interface CacheEntry {
  data: any
  expires: number
}

/**
 * AWS API Client - Makes authenticated requests to AWS services
 */
export class AWSClient {
  private credentials?: AWSCredentials
  private config: AWSClientConfig
  private cache: Map<string, CacheEntry>
  private xmlParser: XMLParser

  constructor(credentials?: AWSCredentials, config?: AWSClientConfig) {
    this.credentials = credentials || this.loadCredentials()
    this.config = {
      maxRetries: 3,
      retryDelay: 1000,
      cacheEnabled: true,
      defaultCacheTTL: 60000, // 1 minute
      ...config,
    }
    this.cache = new Map()
    this.xmlParser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text',
      parseAttributeValue: true,
      trimValues: true,
    })
  }

  /**
   * Load AWS credentials from environment variables
   */
  private loadCredentials(): AWSCredentials {
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY
    const sessionToken = process.env.AWS_SESSION_TOKEN

    if (!accessKeyId || !secretAccessKey) {
      throw new Error('AWS credentials not found. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables.')
    }

    return {
      accessKeyId,
      secretAccessKey,
      sessionToken,
    }
  }

  /**
   * Make a signed AWS API request with retry logic and caching
   */
  async request(options: AWSRequestOptions): Promise<any> {
    // Check cache first for GET requests
    if (options.method === 'GET' && this.config.cacheEnabled && options.cacheKey) {
      const cached = this.getFromCache(options.cacheKey)
      if (cached !== null) {
        return cached
      }
    }

    const maxRetries = options.retries ?? this.config.maxRetries ?? 3
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.makeRequest(options)

        // Cache successful GET requests
        if (options.method === 'GET' && this.config.cacheEnabled && options.cacheKey) {
          this.setInCache(
            options.cacheKey,
            result,
            options.cacheTTL ?? this.config.defaultCacheTTL ?? 60000,
          )
        }

        return result
      }
      catch (error: any) {
        lastError = error

        // Check if error is retryable
        const isRetryable = this.shouldRetry(error)

        // Don't retry non-retryable errors
        if (!isRetryable) {
          throw error
        }

        // Last attempt
        if (attempt === maxRetries) {
          throw error
        }

        // Wait before retrying with exponential backoff
        const delay = this.calculateRetryDelay(attempt)
        await this.sleep(delay)
      }
    }

    throw lastError || new Error('Request failed after retries')
  }

  /**
   * Make the actual HTTP request
   */
  private async makeRequest(options: AWSRequestOptions): Promise<any> {
    const credentials = options.credentials || this.credentials
    if (!credentials) {
      throw new Error('AWS credentials not provided')
    }

    const url = this.buildUrl(options)
    const headers = this.signRequest(options, credentials)

    const response = await fetch(url, {
      method: options.method,
      headers,
      body: options.body,
    })

    const responseText = await response.text()

    if (!response.ok) {
      throw this.parseError(responseText, response.status, response.headers)
    }

    // Handle empty responses
    if (!responseText || responseText.trim() === '') {
      if (options.returnHeaders) {
        return { body: null, headers: this.headersToObject(response.headers) }
      }
      return null
    }

    // Return raw response if requested (useful for S3 getObject with non-XML content)
    if (options.rawResponse) {
      if (options.returnHeaders) {
        return { body: responseText, headers: this.headersToObject(response.headers) }
      }
      return responseText
    }

    // Parse XML or JSON response
    let body: any
    if (responseText.startsWith('<')) {
      body = this.parseXmlResponse(responseText)
    }
    else {
      try {
        body = JSON.parse(responseText)
      }
      catch {
        body = responseText
      }
    }

    // Return with headers if requested
    if (options.returnHeaders) {
      return { body, headers: this.headersToObject(response.headers) }
    }

    return body
  }

  /**
   * Convert Headers object to plain object
   */
  private headersToObject(headers: Headers): Record<string, string> {
    const result: Record<string, string> = {}
    headers.forEach((value, key) => {
      result[key] = value
    })
    return result
  }

  /**
   * Build the full URL for the request
   */
  private buildUrl(options: AWSRequestOptions): string {
    const { service, region, path, queryParams } = options

    let host: string
    if (service === 's3') {
      host = `s3.${region}.amazonaws.com`
    }
    else if (service === 'cloudfront') {
      host = 'cloudfront.amazonaws.com'
    }
    else if (service === 'iam') {
      // IAM is a global service - no region in the endpoint
      host = 'iam.amazonaws.com'
    }
    else if (service === 'route53') {
      // Route53 is a global service
      host = 'route53.amazonaws.com'
    }
    else if (service === 'route53domains') {
      // Route53 Domains is only available in us-east-1
      host = 'route53domains.us-east-1.amazonaws.com'
    }
    else if (service === 'ecr') {
      // ECR uses api.ecr subdomain for the JSON API
      host = `api.ecr.${region}.amazonaws.com`
    }
    else if (service === 'ses') {
      // SES v1 API uses email subdomain
      host = `email.${region}.amazonaws.com`
    }
    else {
      host = `${service}.${region}.amazonaws.com`
    }

    let url = `https://${host}${path}`

    if (queryParams && Object.keys(queryParams).length > 0) {
      const queryString = new URLSearchParams(queryParams).toString()
      url += `?${queryString}`
    }

    return url
  }

  /**
   * Sign the request using AWS Signature Version 4
   */
  private signRequest(options: AWSRequestOptions, credentials: AWSCredentials): Record<string, string> {
    const { service, region, method, path, queryParams, body } = options

    const now = new Date()
    const amzDate = this.getAmzDate(now)
    const dateStamp = this.getDateStamp(now)

    let host: string
    if (service === 's3') {
      host = `s3.${region}.amazonaws.com`
    }
    else if (service === 'cloudfront') {
      host = 'cloudfront.amazonaws.com'
    }
    else if (service === 'iam') {
      // IAM is a global service - no region in the endpoint
      host = 'iam.amazonaws.com'
    }
    else if (service === 'route53') {
      // Route53 is a global service
      host = 'route53.amazonaws.com'
    }
    else if (service === 'route53domains') {
      // Route53 Domains is only available in us-east-1
      host = 'route53domains.us-east-1.amazonaws.com'
    }
    else if (service === 'ecr') {
      // ECR uses api.ecr subdomain for the JSON API
      host = `api.ecr.${region}.amazonaws.com`
    }
    else if (service === 'ses') {
      // SES v1 API uses email subdomain
      host = `email.${region}.amazonaws.com`
    }
    else {
      host = `${service}.${region}.amazonaws.com`
    }

    // Build canonical headers
    const headers: Record<string, string> = {
      'host': host,
      'x-amz-date': amzDate,
      ...(options.headers || {}),
    }

    if (credentials.sessionToken) {
      headers['x-amz-security-token'] = credentials.sessionToken
    }

    if (body) {
      // Don't override content-type if already set (case-insensitive check)
      const hasContentType = Object.keys(headers).some(
        k => k.toLowerCase() === 'content-type'
      )
      if (!hasContentType) {
        headers['content-type'] = 'application/x-www-form-urlencoded'
      }
      headers['content-length'] = Buffer.byteLength(body).toString()
    }

    // Create canonical request
    const payloadHash = this.sha256(body || '')
    headers['x-amz-content-sha256'] = payloadHash

    const canonicalUri = path
    const canonicalQueryString = queryParams
      ? new URLSearchParams(queryParams).toString()
      : ''

    // Sort headers by lowercase key name (AWS SigV4 requirement)
    const sortedHeaderKeys = Object.keys(headers).sort((a, b) =>
      a.toLowerCase().localeCompare(b.toLowerCase())
    )

    const canonicalHeaders = sortedHeaderKeys
      .map(key => `${key.toLowerCase()}:${headers[key].trim()}\n`)
      .join('')

    const signedHeaders = sortedHeaderKeys
      .map(key => key.toLowerCase())
      .join(';')

    const canonicalRequest = [
      method,
      canonicalUri,
      canonicalQueryString,
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n')

    // Create string to sign
    const algorithm = 'AWS4-HMAC-SHA256'
    // Some AWS services use different service names for endpoint vs credential scope
    // SES v2 API uses 'email' as endpoint but 'ses' for credential scope
    // Pinpoint uses 'pinpoint' as endpoint but 'mobiletargeting' for credential scope
    let signingService = service
    if (service === 'email') signingService = 'ses'
    if (service === 'pinpoint') signingService = 'mobiletargeting'
    const credentialScope = `${dateStamp}/${region}/${signingService}/aws4_request`
    const stringToSign = [
      algorithm,
      amzDate,
      credentialScope,
      this.sha256(canonicalRequest),
    ].join('\n')

    // Calculate signature
    const signingKey = this.getSignatureKey(credentials.secretAccessKey, dateStamp, region, signingService)
    const signature = this.hmac(signingKey, stringToSign)

    // Build authorization header
    const authorizationHeader = `${algorithm} Credential=${credentials.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

    return {
      ...headers,
      'Authorization': authorizationHeader,
    }
  }

  /**
   * Get AMZ date format (YYYYMMDDTHHMMSSZ)
   */
  private getAmzDate(date: Date): string {
    return date.toISOString().replace(/[:-]|\.\d{3}/g, '')
  }

  /**
   * Get date stamp (YYYYMMDD)
   */
  private getDateStamp(date: Date): string {
    return date.toISOString().slice(0, 10).replace(/-/g, '')
  }

  /**
   * SHA256 hash
   */
  private sha256(data: string): string {
    return crypto.createHash('sha256').update(data, 'utf8').digest('hex')
  }

  /**
   * HMAC SHA256
   */
  private hmac(key: Buffer | string, data: string): string {
    return crypto.createHmac('sha256', key).update(data, 'utf8').digest('hex')
  }

  /**
   * Get signature key
   */
  private getSignatureKey(key: string, dateStamp: string, region: string, service: string): Buffer {
    const kDate = crypto.createHmac('sha256', `AWS4${key}`).update(dateStamp).digest()
    const kRegion = crypto.createHmac('sha256', kDate).update(region).digest()
    const kService = crypto.createHmac('sha256', kRegion).update(service).digest()
    const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest()
    return kSigning
  }

  /**
   * Parse XML response using fast-xml-parser
   */
  private parseXmlResponse(xml: string): any {
    try {
      const parsed = this.xmlParser.parse(xml)

      // Extract the main result from common AWS response wrappers
      if (parsed.ErrorResponse) {
        throw this.createErrorFromXml(parsed.ErrorResponse.Error)
      }

      // Remove XML wrapper nodes to get to actual data
      const keys = Object.keys(parsed)
      if (keys.length === 1) {
        return parsed[keys[0]]
      }

      return parsed
    }
    catch (error: any) {
      // If parsing fails, return empty object
      if (error.code || error.statusCode) {
        throw error
      }
      return {}
    }
  }

  /**
   * Parse error response and create detailed error object
   */
  private parseError(responseText: string, statusCode: number, headers: Headers): AWSError {
    const error: AWSError = new Error() as AWSError
    error.statusCode = statusCode
    error.requestId = headers.get('x-amzn-requestid') || headers.get('x-amz-request-id') || undefined

    // Try to parse XML error
    if (responseText.startsWith('<')) {
      try {
        const parsed = this.xmlParser.parse(responseText)

        if (parsed.ErrorResponse?.Error) {
          const awsError = parsed.ErrorResponse.Error
          error.code = awsError.Code
          error.message = `AWS Error [${awsError.Code}]: ${awsError.Message || 'Unknown error'}`
          error.type = awsError.Type
          return error
        }

        if (parsed.Error) {
          error.code = parsed.Error.Code
          error.message = `AWS Error [${parsed.Error.Code}]: ${parsed.Error.Message || 'Unknown error'}`
          return error
        }
      }
      catch {
        // Fall through to generic error
      }
    }

    // Try to parse JSON error
    try {
      const json = JSON.parse(responseText)
      if (json.__type || json.code) {
        error.code = json.__type || json.code
        error.message = `AWS Error [${error.code}]: ${json.message || json.Message || 'Unknown error'}`
        return error
      }
    }
    catch {
      // Fall through to generic error
    }

    // Generic error
    error.message = `AWS API Error (${statusCode}): ${responseText}`
    return error
  }

  /**
   * Create error from XML error object
   */
  private createErrorFromXml(errorData: any): AWSError {
    const error: AWSError = new Error() as AWSError
    error.code = errorData.Code
    error.message = `AWS Error [${errorData.Code}]: ${errorData.Message || 'Unknown error'}`
    error.type = errorData.Type
    return error
  }

  /**
   * Check if error code is retryable
   */
  private isRetryableError(code: string): boolean {
    const retryableCodes = [
      // Timeout errors
      'RequestTimeout',
      'RequestTimeoutException',
      'PriorRequestNotComplete',
      'ConnectionError',
      // Throttling errors
      'ThrottlingException',
      'Throttling',
      'TooManyRequestsException',
      'ProvisionedThroughputExceededException',
      'RequestLimitExceeded',
      'BandwidthLimitExceeded',
      'SlowDown',
      // Service errors
      'ServiceUnavailable',
      'ServiceUnavailableException',
      'InternalError',
      'InternalFailure',
      'InternalServerError',
      'InternalServiceException',
      // Transient errors
      'TransientError',
      'TransientFailure',
      'IDPCommunicationErrorException',
      // Network errors
      'NetworkError',
      'ConnectionRefusedException',
      'EC2ThrottledException',
      // S3 specific
      '503 Slow Down',
      '500 InternalError',
    ]
    return retryableCodes.includes(code)
  }

  /**
   * Check if HTTP status code is retryable
   */
  private isRetryableStatusCode(statusCode: number): boolean {
    return statusCode >= 500 || statusCode === 429 // Server errors or Too Many Requests
  }

  /**
   * Determine if an error should be retried
   */
  private shouldRetry(error: any): boolean {
    // Network/fetch errors should be retried
    if (error.name === 'FetchError' || error.name === 'TypeError' || error.code === 'ECONNRESET') {
      return true
    }

    // Check by error code
    if (error.code && this.isRetryableError(error.code)) {
      return true
    }

    // Check by status code
    if (error.statusCode && this.isRetryableStatusCode(error.statusCode)) {
      return true
    }

    // Don't retry client errors (4xx) except 429
    if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500 && error.statusCode !== 429) {
      return false
    }

    // Default: don't retry if we have a status code
    if (error.statusCode) {
      return false
    }

    // Unknown errors: retry once in case it's a transient issue
    return true
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(attempt: number): number {
    const baseDelay = this.config.retryDelay ?? 1000
    const maxDelay = 30000 // 30 seconds max
    const delay = Math.min(baseDelay * (2 ** attempt), maxDelay)
    // Add jitter to avoid thundering herd
    const jitter = Math.random() * 0.3 * delay
    return delay + jitter
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Get value from cache
   */
  private getFromCache(key: string): any | null {
    const entry = this.cache.get(key)
    if (!entry) {
      return null
    }

    // Check if expired
    if (Date.now() > entry.expires) {
      this.cache.delete(key)
      return null
    }

    return entry.data
  }

  /**
   * Set value in cache
   */
  private setInCache(key: string, data: any, ttl: number): void {
    this.cache.set(key, {
      data,
      expires: Date.now() + ttl,
    })
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear()
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCache(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expires) {
        this.cache.delete(key)
      }
    }
  }
}

/**
 * Build query string for AWS API calls
 */
export function buildQueryParams(params: Record<string, any>): Record<string, string> {
  const result: Record<string, string> = {}

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) {
      continue
    }

    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        result[`${key}.${index + 1}`] = String(item)
      })
    }
    else if (typeof value === 'object') {
      for (const [subKey, subValue] of Object.entries(value)) {
        result[`${key}.${subKey}`] = String(subValue)
      }
    }
    else {
      result[key] = String(value)
    }
  }

  return result
}
