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
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'before' | 'after' | 'view';

export type RouteCallback = (params?: Record<string, any>) => any

export interface Route {
  uri: string
  method: HttpMethod
  pattern: RegExp
  callback: RouteCallback
  paramNames: string[]
}

export interface Middleware {
  before?: RouteCallback
  after?: RouteCallback
}

export interface RouteGroupOptions {
  prefix?: string
  middleware?: Middleware[]
}
