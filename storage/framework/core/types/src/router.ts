import type { Action } from '@stacksjs/actions'

type ActionPath = string // TODO: narrow this by automating its generation

// need to refactor before, after, view to be a part of some other type
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'before' | 'after' | 'view'

export type RouteCallback = (params?: Record<string, any>) => any | string | object

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

export interface MiddlewareOptions {
  name: string
  description?: string
  priority: number
  handle: Function
}

export type StatusCode = 200 | 201 | 202 | 204 | 301 | 302 | 304 | 400 | 401 | 403 | 404 | 500
export type RedirectCode = Extract<StatusCode, 301 | 302>

export type RouteParam = { [key: string]: string | number} | null;

export type MiddlewareFn = () => void

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
  get: (url: Route['url'], callback: Route['callback']) => Promise<this>
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
