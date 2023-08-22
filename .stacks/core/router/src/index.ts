/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment */

import { type HttpMethod, type Middleware, type Route, type RouteCallback, type RouteGroupOptions } from '@stacksjs/types'

export class Router {
  private routes: Route[] = []

  addRoute(method: HttpMethod, url: string, callback: RouteCallback): void {
    const paramNames: string[] = []
    const pattern = new RegExp(`^${url.replace(/:[a-zA-Z]+/g, (match) => {
      paramNames.push(match.slice(1))
      return '([a-zA-Z0-9-]+)'
    })}$`)
    this.routes.push({ method, pattern, callback, paramNames })
  }

  group(options: RouteGroupOptions, callback: () => void): void {
    const { prefix = '', middleware = [] } = options
    const routes = this.routes.slice()
    this.routes = []

    middleware.forEach((m) => {
      if (m.before)
        this.before(m.before)

      if (m.after)
        this.after(m.after)
    })

    callback()

    this.routes = this.routes.map((r) => {
      return {
        ...r,
        pattern: new RegExp(`^${prefix}${r.pattern.source}$`),
      }
    }).concat(routes)
  }

  before(callback: RouteCallback): void {
    this.routes.unshift({ method: 'before', pattern: /^$/, callback, paramNames: [] })
  }

  after(callback: RouteCallback): void {
    this.routes.push({ method: 'after', pattern: /^$/, callback, paramNames: [] })
  }

  async handleRequest(method: HttpMethod, url: string): Promise<any> {
    const route = this.matchRoute(method, url)
    if (!route)
      throw new Error('Route not found')

    const params = this.extractParams(route, url)
    const middleware = this.getMiddleware(route)

    // if (middleware.before)
    //   await middleware.before(params)

    const result = await route.callback(params)

    // if (middleware.after)
    //   await middleware.after(params)

    return result
  }

  async get(url: string, callback: RouteCallback): Promise<void> {
    this.addRoute('get', url, callback)
  }

  async post(url: string, callback: RouteCallback): Promise<void> {
    this.addRoute('post', url, callback)
  }

  async put(url: string, callback: RouteCallback): Promise<void> {
    this.addRoute('put', url, callback)
  }

  async patch(url: string, callback: RouteCallback): Promise<void> {
    this.addRoute('patch', url, callback)
  }

  async delete(url: string, callback: RouteCallback): Promise<void> {
    this.addRoute('delete', url, callback)
  }

  private matchRoute(method: HttpMethod, url: string): Route | null {
    const route = this.routes.find(r => r.method === method && r.pattern.test(url))
    return route || null
  }

  private extractParams(route: Route, url: string): Record<string, any> {
    const matches = url.match(route.pattern)
    const params: Record<string, any> = {}
    if (matches) {
      route.paramNames.forEach((name, i) => {
        params[name] = matches[i + 1]
      })
    }
    return params
  }

  private getMiddleware(route: Route): Middleware {
    const before = this.routes.filter(r => r.method === 'before')
    const after = this.routes.filter(r => r.method === 'after')
    const middleware: Middleware = {}

    before.forEach((b) => {
      if (b.pattern.test(route.pattern.source))
        middleware.before = b.callback
    })

    after.forEach((a) => {
      if (a.pattern.test(route.pattern.source))
        middleware.after = a.callback
    })

    return middleware
  }
}

export const route = new Router()
