import type { RequestInstance, RouteParam } from '@stacksjs/types'

import type { VineType } from '@stacksjs/types'
import { customValidate, validateField } from '@stacksjs/validation'

interface RequestData {
  [key: string]: any
}

interface ValidationField {
  rule: VineType
  message: Record<string, string>
}

interface CustomAttributes {
  [key: string]: ValidationField
}

type RouteParams = { [key: string]: string | number } | null

export class Request<T extends RequestData = RequestData> implements RequestInstance {
  public query: T = {} as T
  public params: RouteParams = null
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

  public get(element: string): string | number | undefined {
    return this.query[element]
  }

  public all(): T {
    return this.query
  }

  public async validate(attributes?: CustomAttributes): Promise<void> {
    if (attributes === undefined || attributes === null) {
      await validateField('Release', this.all())
    } else {
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
}

export const request = new Request()
