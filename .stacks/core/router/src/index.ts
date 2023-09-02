import type { RedirectCode, Route, RouteGroupOptions, StatusCode } from '@stacksjs/types'
import { projectPath } from '@stacksjs/path'

export interface Router {
  get(url: Route['url'], callback: Route['callback']): this
  post(url: Route['url'], callback: Route['callback']): this
  view(url: Route['url'], callback: Route['callback']): this
  redirect(url: Route['url'], callback: Route['callback'], status?: RedirectCode): this
  delete(url: Route['url'], callback: Route['callback']): this
  patch(url: Route['url'], callback: Route['callback']): this
  put(url: Route['url'], callback: Route['callback']): this
  group(options: RouteGroupOptions, callback: () => void): this
  middleware(middleware: Route['middleware']): this
  getRoutes(): Promise<Route[]>
}

export class Router implements Router {
  private routes: Route[] = []

  private addRoute(method: Route['method'], uri: string, callback: Route['callback'] | string | object, statusCode: StatusCode): void {
    const pattern = new RegExp(`^${uri.replace(/:[a-zA-Z]+/g, (match) => {
      return '([a-zA-Z0-9-]+)'
    })}$`)

    let routeCallback: Route['callback']

    if (typeof callback === 'string' || typeof callback === 'object') {
      // Convert string or object to RouteCallback
      routeCallback = () => callback
    } else {
      routeCallback = callback
    }

    this.routes.push({
      method,
      url: uri,
      uri,
      callback: routeCallback,
      pattern,
      statusCode,
      paramNames: []
    })
  }

  public get(url: Route['url'], callback: Route['callback']): this {
    this.addRoute('GET', url, callback, 200)
    return this
  }

  public post(url: Route['url'], callback: Route['callback']): this {
    this.addRoute('POST', url, callback, 201)
    return this
  }

  public view(url: Route['url'], callback: Route['callback']): this {
    this.addRoute('GET', url, callback, 200)
    return this
  }

  public redirect(url: Route['url'], callback: Route['callback'], status?: RedirectCode): this {
    this.addRoute('GET', url, callback, 302)
    return this
  }

  public delete(url: Route['url'], callback: Route['callback']): this {
    this.addRoute('DELETE', url, callback, 204)
    return this
  }

  public patch(url: Route['url'], callback: Route['callback']): this {
    this.addRoute('PATCH', url, callback, 202)
    return this
  }

  public put(url: Route['url'], callback: Route['callback']): this {
    this.addRoute('PUT', url, callback, 202)
    return this
  }

  public group(options: RouteGroupOptions | (() => void), callback?: () => void): this {
    let cb: () => void

    if (typeof options === 'function') {
      cb = options
      options = {}
    }
    else {
      if (!callback) throw new Error('Missing callback function for route group.')
      cb = callback
    }

    const { prefix = '', middleware = [] } = options

    // Save a reference to the original routes array.
    const originalRoutes = this.routes

    // Create a new routes array for the duration of the callback.
    this.routes = []

    // Execute the callback. This will add routes to the new this.routes array.
    cb()

    // For each route added by the callback, adjust the URI and add to the original routes array.
    this.routes.forEach((r) => {
      r.uri = `${prefix}${r.uri}`

      if (middleware.length)
        r.middleware = middleware
      // Assuming you have a middleware property for each route.

      originalRoutes.push(r)
      return this
    })

    // Restore the original routes array.
    this.routes = originalRoutes

    return this
  }

  public middleware(middleware: Route['middleware']): this {
    // @ts-ignore
    this.routes[this.routes.length - 1].middleware = middleware

    return this
  }

  public prefix(prefix: string): this {
    // @ts-ignore
    this.routes[this.routes.length - 1].prefix = prefix

    return this
  }

  public async getRoutes(): Promise<Route[]> {
    // const routeFileData = (await readTextFile(projectPath('routes/web.ts'))).data

    await import(projectPath('routes/web.ts'))

    // run routes/web.ts
    // const webRoutesPath = projectPath('routes/web.ts')
    // await runCommand(`bun ${webRoutesPath}`)

    // set this.routes to a mapped array of routes that matches the pattern

    return this.routes
  }
}

export const route = new Router()
