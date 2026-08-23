import type { Action } from '@stacksjs/actions'
type Request = any
import type { ValidationType } from '@stacksjs/ts-validation'
import type { HttpMethod } from './request'

type ActionPath = string
// need to refactor before, after, view to be a part of some other type
export type RouteCallback = ((_params?: Record<string, any>) => any | string | object) | ((req: any, res: any) => Promise<void>)

export interface RequestData {
  [key: string]: any
}

export interface ValidationField {
  rule: ValidationType
  message: Record<string, string>
}

export type RouterAuthToken = `${number}:${number}:${string}`

export interface CustomAttributes {
  [key: string]: ValidationField
}

/**
 * URL route parameters. Always strings at runtime - the router does no
 * coercion. Use `Number(...)` or `getParamAsInt()` when you want a number.
 */
export interface RouteParams { [key: string]: string }

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

export type MiddlewareFn = (_request: Request) => Promise<void>

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
  get: (element: string, defaultValue?: string) => string
  all: () => any
  validate: (attributes?: CustomAttributes) => Promise<void>
  has: (element: string) => boolean
  isEmpty: () => boolean
  extractParamsFromRoute: (routePattern: string, pathname: string) => void
  header: (headerParam: string) => string | number | boolean | null
  getHeaders: () => any
  Header: (headerParam: string) => string | number | boolean | null
  getParam: (key: string) => string
  route: (key: string) => number | string | null
  bearerToken: () => string | null | RouterAuthToken
  getParams: () => RouteParams
  getParamAsInt: (key: string) => number | null
  browser: () => string | null
  ip: () => string | null
  ipForRateLimit: () => string | null
}

/*
 * ── Typed routes ──────────────────────────────────────────────────────────
 *
 * The contract between `createTypedRouter()` in `@stacksjs/router` and
 * `createTypedClient()` in `@stacksjs/api`. It lives here rather than in
 * either of them so neither has to import the other to describe a route, and
 * so the two halves cannot drift into disagreeing about what a route is.
 */

/** One route: what a client sends, what it gets back, what the path needs. */
export interface TypedRoute {
  input: unknown
  output: unknown
  params: Record<string, string>
}

/** A whole API, keyed `"METHOD /path"` (e.g. `"GET /v1/projects"`). */
export type TypedRouteMap = Record<string, TypedRoute>

/**
 * The route map behind a typed router, or the map itself.
 *
 * `createTypedRouter()` accumulates its map into a phantom `__routes`
 * property, so `typeof api` carries it and this reads it back out. Passing a
 * map type directly works too - which is what `RoutesOf<typeof api>` gives
 * you, and what an application that would rather name its API explicitly will
 * export.
 */
export type RouteMapOf<T> = T extends { __routes?: infer R }
  ? ([R] extends [TypedRouteMap | undefined] ? NonNullable<R> : never)
  : (T extends TypedRouteMap ? T : never)

/** The paths one method serves, as a union of path literals. */
export type PathsForMethod<R extends TypedRouteMap, M extends string>
  = Extract<keyof R, `${M} ${string}`> extends `${M} ${infer P}` ? P : never
