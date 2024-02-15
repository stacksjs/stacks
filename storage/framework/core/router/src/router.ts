import type { RedirectCode, Route, RouteGroupOptions, StatusCode } from '@stacksjs/types'
import { path as p, projectPath } from '@stacksjs/path'
import { pascalCase } from '@stacksjs/strings'

type Prefix = string

export interface RouterInterface {
  get: (url: Route['url'], callback: Route['callback']) => Promise<this>
  post: (url: Route['url'], callback: Route['callback']) => this
  view: (url: Route['url'], callback: Route['callback']) => this
  redirect: (url: Route['url'], callback: Route['callback'], status?: RedirectCode) => this
  delete: (url: Route['url'], callback: Route['callback']) => this
  patch: (url: Route['url'], callback: Route['callback']) => this
  put: (url: Route['url'], callback: Route['callback']) => this
  group: (options: Prefix | RouteGroupOptions, callback: () => void) => this
  name: (name: string) => this
  middleware: (middleware: Route['middleware']) => this
  getRoutes: () => Promise<Route[]>
}

export class Router implements RouterInterface {
  private routes: Route[] = []
  private apiPrefix = '/api'
  private groupPrefix = ''

  private addRoute(method: Route['method'], uri: string, callback: Route['callback'] | string | object, statusCode: StatusCode): void {
    const name = uri.replace(/\//g, '.').replace(/:/g, '') // we can improve this
    const pattern = new RegExp(`^${uri.replace(/:[a-zA-Z]+/g, (_match) => {
      return '([a-zA-Z0-9-]+)'
    })}$`)

    let routeCallback: Route['callback']

    if (typeof callback === 'string' || typeof callback === 'object') {
      // Convert string or object to RouteCallback
      routeCallback = () => callback
    }
    else {
      routeCallback = callback
    }

    this.routes.push({
      name,
      method,
      url: uri,
      uri,
      callback: routeCallback,
      pattern,
      statusCode,
      paramNames: [],
    })
  }

  public async get(path: Route['url'], callback: Route['callback']): Promise<this> {
    // if the route ends with a /, then remove it
    if (path.endsWith('/'))
      path = path.slice(0, -1)

    // check if callback is a string and if it is, then import that module path and use the default.handle function as the callback
    if (callback instanceof Promise) {
      const actionModule = await callback
      callback = actionModule.default
    }

    else if (typeof callback === 'string') {
      // if it is a relative path, then import the module and
      // use the default.handle function as the callback
      if (callback.startsWith('../')) {
        // import the module and use the default.handle function as the callback
        const actionModule = await import(p.routesPath(callback))

        path = actionModule.default.path ?? path // in case a custom path is defined inside the Action, use that instead of the path passed by the router
        callback = actionModule.default.handle
      }
      // else, given it is a string, import that module path
      // and use the default.handle function as the callback
      else if (callback.startsWith('Action') || callback.startsWith('Job')) {
        // Ensure callback has no trailing .ts before adding it
        const formattedCallback = callback.endsWith('.ts') ? callback.slice(0, -3) : callback
        const actionModule = await import(p.appPath(`${formattedCallback}.ts`))

        path = actionModule.default.path ?? path // in case a custom path is defined inside the Action, use that instead of the path passed by the router
        callback = actionModule.default.handle
      }
      else if (callback.endsWith('Action') || callback.endsWith('Job')) {
        const actionModule = await import(p.userActionsPath(`${callback}.ts`))

        path = actionModule.default.path ?? path // in case a custom path is defined inside the Action, use that instead of the path passed by the router
        callback = actionModule.default.handle
      }
    }

    path = this.preparePath(path)
    this.addRoute('GET', path, callback, 200)

    return this
  }

  public preparePath(path: string) {
    // if string starts with / then remove it because we are adding it back in the next line
    if (path.startsWith('/'))
      path = path.slice(1)

    return `${this.apiPrefix}${this.groupPrefix}/${path}`
  }

  public async health(): Promise<this> {
    const healthModule = await import(p.userActionsPath('HealthAction.ts'))
    const callback = healthModule.default.handle

    this.addRoute('GET', `${this.apiPrefix}/health`, callback, 200)

    return this
  }

  public async job(path: Route['url']): Promise<this> {
    path = pascalCase(path)

    // removes the potential `JobJob` suffix in case the user does not choose to use the Job suffix in their file name
    const jobModule = await import(p.userJobsPath(`${path}Job.ts`.replace(/JobJob/, 'Job')))
    const callback = jobModule.default.handle

    path = this.preparePath(path)
    this.addRoute('GET', path, callback, 200)

    return this
  }

  public async action(path: Route['url']): Promise<this> {
    path = pascalCase(path) // actions are PascalCase

    // removes the potential `JobJob` suffix in case the user does not choose to use the Job suffix in their file name
    const actionModule = await import(p.userActionsPath(`${path}.ts`))
    const callback = actionModule.default.handle

    path = this.preparePath(path)
    this.addRoute('GET', path, callback, 200)

    return this
  }

  public post(path: Route['url'], callback: Route['callback']): this {
    path = this.preparePath(path)
    this.addRoute('POST', path, callback, 201)

    return this
  }

  public view(path: Route['url'], callback: Route['callback']): this {
    this.addRoute('GET', path, callback, 200)

    return this
  }

  public redirect(path: Route['url'], callback: Route['callback'], _status?: RedirectCode): this {
    this.addRoute('GET', path, callback, 302)

    return this
  }

  public delete(path: Route['url'], callback: Route['callback']): this {
    this.addRoute('DELETE', path, callback, 204)
    return this
  }

  public patch(path: Route['url'], callback: Route['callback']): this {
    this.addRoute('PATCH', path, callback, 202)
    return this
  }

  public put(path: Route['url'], callback: Route['callback']): this {
    this.addRoute('PUT', path, callback, 202)
    return this
  }

  public group(options: string | RouteGroupOptions, callback?: () => void): this {
    let cb: () => void

    this.prepareGroupPrefix(options)

    if (typeof options === 'function') {
      cb = options
      options = {}
    }
    else {
      if (!callback)
        throw new Error('Missing callback function for route group.')
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

  public name(name: string): this {
    // @ts-expect-error - this is fine for now
    this.routes[this.routes.length - 1].name = name

    return this
  }

  public middleware(middleware: Route['middleware']): this {
    // @ts-expect-error - this is fine for now
    this.routes[this.routes.length - 1].middleware = middleware

    return this
  }

  public prefix(prefix: string): this {
    // @ts-expect-error - this is fine for now
    this.routes[this.routes.length - 1].prefix = prefix

    return this
  }

  public async getRoutes(): Promise<Route[]> {
    // const routeFileData = (await readTextFile(projectPath('routes/web.ts'))).data

    await import(projectPath('routes/api.ts'))

    // run routes/web.ts
    // const webRoutesPath = projectPath('routes/web.ts')
    // await runCommand(`bun ${webRoutesPath}`)

    // set this.routes to a mapped array of routes that matches the pattern

    return this.routes
  }

  private setGroupPrefix(prefix: string, options: RouteGroupOptions) {
    if (prefix !== '')
      prefix = `/${prefix}`

    if (typeof options === 'string') {
      this.groupPrefix = options
      return
    }

    if (typeof options === 'function') {
      this.groupPrefix = prefix ?? ''
      return
    }

    this.groupPrefix = options.prefix ?? prefix ?? ''
  }

  private prepareGroupPrefix(options: string | RouteGroupOptions): void {
    if (this.groupPrefix !== '' && typeof options !== 'string')
      return this.setGroupPrefix(this.groupPrefix, options)

    if (typeof options === 'string')
      return this.setGroupPrefix(options)

    return this.setGroupPrefix('', options)
  }
}

export const route = new Router()
