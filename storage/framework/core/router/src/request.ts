import type { RequestInstance, RouteParam, VineType } from '@stacksjs/types'

import { customValidate, validateField } from '@stacksjs/validation'

interface RequestData {
  [key: string]: any
}

interface ValidationField {
  rule: VineType
  message: Record<string, string>
}

type AuthToken = `${number}:${number}:${string}`

interface CustomAttributes {
  [key: string]: ValidationField
}

interface RouteParams { [key: string]: string | number }

export class Request<T extends RequestData = RequestData> implements RequestInstance {
  public query: T = {} as T
  public params: RouteParams = {} as RouteParams
  public headers: any = {}

  public addQuery(url: URL): void {
    this.query = Object.fromEntries(url.searchParams) as unknown as T
  }

  public addBodies(params: any): void {
    this.query = params
  }

  public addParam(param: RouteParam): void {
    this.params = param
  }

  public addHeaders(headerParams: Headers): void {
    this.headers = headerParams
  }

  public get<T>(element: string, defaultValue?: T): T {
    return this.query[typeof element] || defaultValue
  }

  public all(): T {
    return this.query
  }

  public async validate(attributes?: CustomAttributes): Promise<void> {
    if (attributes === undefined || attributes === null) {
      await validateField('Release', this.all())
    }
    else {
      await customValidate(attributes, this.all())
    }
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

  public getParam<T>(key: string): T {
    return this.params[key] as T
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
        // Handle multiple IPs in headers like x-forwarded-for
        const ips = ip.split(',').map((ip: string) => ip.trim())
        // Return the first valid IP address
        for (const potentialIp of ips) {
          if (this.isValidIp(potentialIp)) {
            return potentialIp
          }
        }
      }
    }

    return null
  }

  private isValidIp(ip: string): boolean {
    // Check if it's a valid IPv4 or IPv6 address
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
    const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/
    
    return ipv4Regex.test(ip) || ipv6Regex.test(ip)
  }
}

export const request: Request = new Request()
