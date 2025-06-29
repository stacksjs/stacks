import type { Action } from '@stacksjs/actions'
import type { Request } from '@stacksjs/router'
import type { ValidationType } from '@stacksjs/ts-validation'
import type { HttpMethod } from './request'

type ActionPath = string
// need to refactor before, after, view to be a part of some other type
export type RouteCallback = ((params?: Record<string, any>) => any | string | object) | ((req: any, res: any) => Promise<void>)

export interface RequestData {
  [key: string]: any
}

export interface ValidationField {
  rule: ValidationType
  message: Record<string, string>
}

export type AuthToken = `${number}:${number}:${string}`

export interface CustomAttributes {
  [key: string]: ValidationField
}

export interface RouteParams { [key: string]: string | number }

export type NumericField = 'id' | 'age' | 'count' | 'quantity' | 'amount' | 'price' | 'total' | 'score' | 'rating' | 'duration' | 'size' | 'weight' | 'height' | 'width' | 'length' | 'distance' | 'speed' | 'temperature' | 'volume' | 'capacity' | 'density' | 'pressure' | 'force' | 'energy' | 'power' | 'frequency' | 'voltage' | 'current' | 'resistance' | 'time' | 'date' | 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second' | 'millisecond' | 'microsecond' | 'nanosecond'

export interface Route {
  name: string
  uri: string
  url: string // used synonymously with uri, TODO: narrow this type by ensuring it's generated
  path?: string
  prefix?: string
  method: HttpMethod
  pattern: RegExp
  callback: RouteCallback | ActionPath | Action | Promise<any> // we may be able to improve the `Promise<any>` if we could narrow this type `import('../app/Actions/BuddyAction')`
  paramNames: string[]
  middleware?: string | string[]
  statusCode?: StatusCode
}

export interface ServeOptions {
  host?: string
  port?: number
  debug?: boolean
  timezone?: string
}

export interface Options {
  statusCode?: StatusCode
}

export interface MiddlewareOptions {
  name: string
  description?: string
  priority: number
  handle: (request: Request) => Promise<void> | void
}

export type StatusCode = 200 | 201 | 202 | 204 | 301 | 302 | 304 | 400 | 401 | 403 | 404 | 500
export type RedirectCode = Extract<StatusCode, 301 | 302>

export interface RouteParam { [key: string]: string | number }

export type MiddlewareFn = (request: Request) => Promise<void>

export interface Middlewares {
  logger: MiddlewareFn
  auth: MiddlewareFn
  [key: string]: MiddlewareFn
}

export interface RouteGroupOptions {
  prefix?: string
  middleware?: Route['middleware']
}

type Prefix = string

export interface RouterInterface {
  get: (url: Route['url'], callback: Route['callback']) => this
  post: (url: Route['url'], callback: Route['callback']) => this
  view: (url: Route['url'], callback: Route['callback']) => this
  redirect: (url: Route['url'], callback: Route['callback'], status?: RedirectCode) => this
  delete: (url: Route['url'], callback: Route['callback']) => this
  patch: (url: Route['url'], callback: Route['callback']) => this
  put: (url: Route['url'], callback: Route['callback']) => this
  email: (url: Route['url']) => Promise<this>
  health: () => Promise<this>
  job: (url: Route['url']) => Promise<this>
  action: (url: Route['url']) => Promise<this>
  group: (options: Prefix | RouteGroupOptions, callback: () => void) => this
  name: (name: string) => this
  middleware: (middleware: Route['middleware']) => this
  getRoutes: () => Promise<Route[]>
}

export interface RouterInstance {
  query: any
  params: RouteParams
  headers: any
  addQuery: (url: URL) => void
  addBodies: (params: any) => void
  addParam: (param: RouteParam) => void
  addHeaders: (headerParams: Headers) => void
  get: <K extends string>(element: K, defaultValue?: K extends NumericField ? number : string) => K extends NumericField ? number : string
  all: () => any
  validate: (attributes?: CustomAttributes) => Promise<void>
  has: (element: string) => boolean
  isEmpty: () => boolean
  extractParamsFromRoute: (routePattern: string, pathname: string) => void
  header: (headerParam: string) => string | number | boolean | null
  getHeaders: () => any
  Header: (headerParam: string) => string | number | boolean | null
  getParam: <T>(key: string) => T
  route: (key: string) => number | string | null
  bearerToken: () => string | null | AuthToken
  getParams: () => RouteParams
  getParamAsInt: (key: string) => number | null
  browser: () => string | null
  ip: () => string | null
  ipForRateLimit: () => string | null
}
