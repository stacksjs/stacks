import type { RequestInstance, RouteParam } from '@stacksjs/types'

interface RequestData {
  [key: string]: string
}

type RouteParams = { [key: string]: string } | null

export class Request implements RequestInstance {
  private static instance: Request
  private query: RequestData = {}
  private params: RouteParams = null
  private headers: any = {}

  // An attempt to singleston instance, might be needed at some point
  public static getInstance(): Request {
    if (!Request.instance) {
      Request.instance = new Request()
    }
    return Request.instance
  }

  public addQuery(url: URL): void {
    this.query = Object.fromEntries(url.searchParams)
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

  public get(element: string): string | number | undefined {
    return this.query[element]
  }

  public all(): RequestData {
    return this.query
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

    if (match?.groups) this.params = match.groups
  }

  public header(headerParam: string): string | number | boolean | null {
    return this.headers.get(headerParam)
  }

  public getHeaders() {
    return this.headers
  }

  public Header(headerParam: string): string | number | boolean | null {
    return this.headers.get(headerParam)
  }

  public getParam(key: string): number | string | null {
    return this.params ? this.params[key] || null : null
  }

  public bearerToken(): string | null {
    const authorizationHeader = this.headers.get('authorization')

    if (authorizationHeader && authorizationHeader.startsWith('Bearer ')) {
      return authorizationHeader.substring(7)
    }

    return null
  }

  public getParams(): RouteParams {
    return this.params
  }

  public getParamAsInt(key: string): number | null {
    const value = this.params ? this.params[key] || null : null
    return value ? Number.parseInt(value) : null
  }
}

export const request = new Request()
