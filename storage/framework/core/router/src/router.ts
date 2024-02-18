import type { RedirectCode, Route, RouteGroupOptions, StatusCode } from '@stacksjs/types'
import { path as p, routesPath } from '@stacksjs/path'
import { log } from '@stacksjs/logging'
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
  email: (url: Route['url']) => Promise<this>
  health: () => Promise<this>
  job: (url: Route['url']) => Promise<this>
  action: (url: Route['url']) => Promise<this>
  group: (options: Prefix | RouteGroupOptions, callback: () => void) => this
  name: (name: string) => this
  middleware: (middleware: Route['middleware']) => this
  getRoutes: () => Promise<Route[]>
}

export class Router implements RouterInterface {
  private routes: Route[] = []
  private apiPrefix = '/api'
  private groupPrefix = ''
  private path = ''

  private addRoute(method: Route['method'], uri: string, callback: Route['callback'] | string | object, statusCode: StatusCode): this {
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

    log.debug(`Adding route: ${method} ${uri} with name ${name}`)

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

    return this
  }

  public async get(path: Route['url'], callback: Route['callback']): Promise<this> {
    this.path = this.normalizePath(path)
    log.debug(`Normalized Path: ${this.path}`)

    callback = await this.resolveCallback(callback)

    const uri = this.prepareUri(this.path)
    log.debug(`Prepared URI: ${uri}`)

    return this.addRoute('GET', uri, callback, 200)
  }

  public async email(path: Route['url']): Promise<this> {
    // wip
    const emailModule = await import(p.userActionsPath('EmailAction.ts'))
    const callback = emailModule.default.handle

    const uri = this.prepareUri(path)
    this.addRoute('GET', uri, callback, 200)

    return this
  }

  public async health(): Promise<this> {
    const healthModule = await import(p.userActionsPath('HealthAction.ts'))
    const callback = healthModule.default.handle

    const path = healthModule.default.path ?? `${this.apiPrefix}/health`

    this.addRoute('GET', path, callback, 200)

    return this
  }

  public async job(path: Route['url']): Promise<this> {
    path = pascalCase(path)

    // removes the potential `JobJob` suffix in case the user does not choose to use the Job suffix in their file name
    const jobModule = await import(p.userJobsPath(`${path}Job.ts`.replace(/JobJob/, 'Job')))
    const callback = jobModule.default.handle

    path = this.prepareUri(path)
    this.addRoute('GET', path, callback, 200)

    return this
  }

  public async action(path: Route['url']): Promise<this> {
    path = pascalCase(path) // actions are PascalCase

    // removes the potential `ActionAction` suffix in case the user does not choose to use the Job suffix in their file name
    const actionModule = await import(p.userActionsPath(`${path}Action.ts`.replace(/ActionAction/, 'Action')))
    const callback = actionModule.default.handle

    path = this.prepareUri(path)
    this.addRoute('GET', path, callback, 200)

    return this
  }

  public post(path: Route['url'], callback: Route['callback']): this {
    path = this.prepareUri(path)
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
    if (typeof options === 'string')
      options = options.startsWith('/') ? options.slice(1) : options

    let cb: () => void

    this.prepareGroupPrefix(options)

    if (typeof options === 'function') {
      cb = options
      options = {}
    }

    if (!callback)
      throw new Error('Missing callback function for your route group.')

    cb = callback

    const { prefix, middleware = [] } = options as RouteGroupOptions

    // Save a reference to the original routes array
    const originalRoutes = this.routes

    // Create a new routes array for the duration of the callback
    this.routes = []

    // Execute the callback. This will add routes to the new this.routes array
    cb()

    // For each route added by the callback, adjust the URI and add to the original routes array
    this.routes.forEach((r) => {
      r.uri = `${prefix}${r.uri}`

      if (middleware.length)
        r.middleware = middleware

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
    await import(routesPath('api.ts'))

    return this.routes
  }

  private setGroupPrefix(prefix: string, options: RouteGroupOptions = {}) {
    if (prefix !== '') {
      prefix = `/${this.groupPrefix}/${prefix}`.replace(/\/\//g, '/') // remove double slashes in case there are any
      this.groupPrefix = prefix
      return
    }

    // Ensure options is always treated as an object, even if it's undefined or a function
    const effectiveOptions = typeof options === 'object' ? options : {}

    this.groupPrefix = effectiveOptions.prefix ?? prefix ?? ''
  }

  private prepareGroupPrefix(options: string | RouteGroupOptions): void {
    if (this.groupPrefix !== '' && typeof options !== 'string')
      return this.setGroupPrefix(this.groupPrefix, options)

    if (typeof options === 'string')
      return this.setGroupPrefix(options)

    return this.setGroupPrefix('', options)
  }

  private async resolveCallback(callback: Route['callback']): Promise<Route['callback']> {
    if (callback instanceof Promise) {
      const actionModule = await callback
      return actionModule.default
    }

    if (typeof callback === 'string')
      return this.importCallbackFromPath(callback, this.path)

    // in this case, the callback ends up being a function
    return callback
  }

  private async importCallbackFromPath(callbackPath: string, originalPath: string): Promise<Route['callback']> {
    let modulePath = callbackPath
    let importPathFunction = p.appPath // Default import path function

    if (callbackPath.startsWith('../'))
      importPathFunction = p.routesPath

    // Remove trailing .ts if present
    modulePath = modulePath.endsWith('.ts') ? modulePath.slice(0, -3) : modulePath
    const actionModule = await import(importPathFunction(`${modulePath}.ts`))

    // Use custom path from action module if available
    const newPath = actionModule.default.path ?? originalPath
    this.updatePathIfNeeded(newPath, originalPath)

    return actionModule.default.handle
  }

  private normalizePath(path: string): string {
    return path.endsWith('/') ? path.slice(0, -1) : path
  }

  public prepareUri(path: string) {
    // if string starts with / then remove it because we are adding it back in the next line
    if (path.startsWith('/'))
      path = path.slice(1)

    path = `${this.apiPrefix}${this.groupPrefix}/${path}`

    // if path ends in "/", then remove it
    // e.g. triggered when route is "/"
    return path.endsWith('/') ? path.slice(0, -1) : path
  }

  private updatePathIfNeeded(newPath: string, originalPath: string): void {
    if (newPath !== originalPath) {
    // Logic to update the path if needed, based on the action module's custom path
      this.path = newPath
    }
  }
}

export const route = new Router()
