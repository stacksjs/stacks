import { type Route, type RouteCallback, type RouteGroupOptions } from '@stacksjs/types'
import { handleRequest } from '../../../../server'

export interface RouteCallback {
  (): void
}

export class Router {
  private routes: Route[] = []

  private addRoute(method: Route['method'], uri: string, callback: RouteCallback | string | object): void {
    const pattern = new RegExp(`^${uri.replace(/:[a-zA-Z]+/g, (match) => {
      return '([a-zA-Z0-9-]+)'
    })}$`)

    this.routes.push({ method, uri, callback, pattern })
  }

  public get(url: string, callback: RouteCallback): void {
    this.addRoute('GET', url, callback)
    handleRequest(this.getRoutes())
  }

  public post(url: string, callback: RouteCallback): void {
    this.addRoute('POST', url, callback)
    handleRequest(this.getRoutes())
  }

  public delete(url: string, callback: RouteCallback): void {
    this.addRoute('DELETE', url, callback)
    handleRequest(this.getRoutes())
  }

  public patch(url: string, callback: RouteCallback): void {
    this.addRoute('PATCH', url, callback)
    handleRequest(this.getRoutes())
  }

  public put(url: string, callback: RouteCallback): void {
    this.addRoute('PUT', url, callback)
    handleRequest(this.getRoutes())
  }

  public group(options: RouteGroupOptions, callback: () => void): void {
    const { prefix = '', middleware = [] } = options

    // Save a reference to the original routes array.
    const originalRoutes = this.routes

    // Create a new routes array for the duration of the callback.
    this.routes = []

    // Execute the callback. This will add routes to the new this.routes array.
    callback()

    // For each route added by the callback, adjust the URI and add to the original routes array.
    this.routes.forEach((r) => {
      r.uri = `${prefix}${r.uri}`
      // Assuming you have a middleware property for each route.

      originalRoutes.push(r)
    })

    // Restore the original routes array.
    this.routes = originalRoutes

    console.log(this.routes)
  }

  // before(callback: RouteCallback): void {
  //   this.routes.unshift({ method: 'before', pattern: /^$/, callback, paramNames: [] })
  // }

  // after(callback: RouteCallback): void {
  //   this.routes.push({ method: 'after', pattern: /^$/, callback, paramNames: [] })
  // }

  public getRoutes(): Route[] {
    return this.routes
  }
}

export const route = new Router()
