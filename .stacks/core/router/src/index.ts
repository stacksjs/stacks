import type { RedirectCode, Route, RouteCallback, RouteGroupOptions, StatusCode } from '@stacksjs/types'
import { projectPath } from '@stacksjs/path'

export class Router {
  private routes: Route[] = []

  private addRoute(method: Route['method'], uri: string, callback: RouteCallback | string | object, statusCode: StatusCode): void {
    const pattern = new RegExp(`^${uri.replace(/:[a-zA-Z]+/g, (match) => {
      return '([a-zA-Z0-9-]+)'
    })}$`)

    this.routes.push({ method, uri, callback, pattern, statusCode })
  }

  public get(url: string, callback: RouteCallback): void {
    this.addRoute('GET', url, callback, 200)
  }

  public post(url: string, callback: RouteCallback): void {
    this.addRoute('POST', url, callback, 201)
  }

  public view(url: string, callback: RouteCallback): void {
    this.addRoute('GET', url, callback, 200)
  }

  public redirect(url: string, callback: RouteCallback, status?: RedirectCode): void {
    this.addRoute('GET', url, callback, 302)
  }

  public delete(url: string, callback: RouteCallback): void {
    this.addRoute('DELETE', url, callback, 204)
  }

  public patch(url: string, callback: RouteCallback): void {
    this.addRoute('PATCH', url, callback, 202)
  }

  public put(url: string, callback: RouteCallback): void {
    this.addRoute('PUT', url, callback, 202)
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

      if (middleware.length)
        r.middleware = middleware
      // Assuming you have a middleware property for each route.

      originalRoutes.push(r)
    })

    // Restore the original routes array.
    this.routes = originalRoutes
  }

  // before(callback: RouteCallback): void {
  //   this.routes.unshift({ method: 'before', pattern: /^$/, callback, paramNames: [] })
  // }

  // after(callback: RouteCallback): void {
  //   this.routes.push({ method: 'after', pattern: /^$/, callback, paramNames: [] })
  // }

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
