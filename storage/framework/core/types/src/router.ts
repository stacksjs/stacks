import type { Action } from '@stacksjs/actions'

export interface NitroEventHandler {
  /**
   * Path prefix or route
   *
   * If an empty string used, will be used as a middleware
   */
  route?: string

  /**
   * Specifies this is a middleware handler.
   * Middleware are called on every route and should normally return nothing to pass to the next handlers
   */
  middleware?: boolean

  /**
   * Use lazy loading to import handler
   */
  lazy?: boolean

  /**
   * Path to event handler
   *
   */
  handler: string

  /**
   * Router method matcher
   */
  method?: string
}

// need to refactor before, after, view to be a part of some other type
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'before' | 'after' | 'view'

export type RouteCallback = (params?: Record<string, any>) => any | string | object

type ActionName = string
export interface Route {
  name: string
  uri: string
  url: string // used synonymously with uri
  method: HttpMethod
  pattern: RegExp
  callback: RouteCallback | ActionName | Action | Promise<any> // we may be able to improve the `Promise<any>` if we could narrow this type `import('../app/Actions/BuddyAction')`
  paramNames: string[]
  middleware?: string | string[]
  statusCode?: StatusCode
}

export interface MiddlewareType {
  name: string
  priority: number

  handle: Function
}

export type StatusCode = 200 | 201 | 202 | 204 | 301 | 302 | 304 | 400 | 401 | 403 | 404 | 500
export type RedirectCode = Extract<StatusCode, 301 | 302>

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
