import type { Action } from '@stacksjs/actions'
import type { Job, RedirectCode, RequestInstance, Route, RouteGroupOptions, RouterInterface, StatusCode } from '@stacksjs/types'
import type { EnhancedRequest } from 'bun-router'
import process from 'node:process'
import { handleError } from '@stacksjs/error-handling'
import { log } from '@stacksjs/logging'
import { path as p } from '@stacksjs/path'
import { fs } from '@stacksjs/storage'
import { kebabCase, pascalCase } from '@stacksjs/strings'
import { customValidate, isObject, isObjectNotEmpty } from '@stacksjs/validation'
import { Router as BunRouter } from 'bun-router'
import { staticRoute } from './static'
import { response } from './response'
import { extractDefaultRequest, findRequestInstanceFromAction } from './utils'

type ActionPath = string

// Global cache busting timestamp for development mode
declare global {
  // eslint-disable-next-line vars-on-top
  var __cacheBuster: number
}

// Initialize cache buster for development
const isProduction = process.env.APP_ENV === 'production' || process.env.APP_ENV === 'prod'
if (!isProduction) {
  globalThis.__cacheBuster = Date.now()
}

/**
 * StacksRouter - A wrapper around bun-router that provides stacks-specific features
 * like Action/Controller resolution, middleware handling, and route grouping
 */
export class Router implements RouterInterface {
  private stacksRoutes: Route[] = []
  private path = ''
  private _bunRouter: BunRouter
  private _pendingRoutes: Promise<any>[] = []

  constructor() {
    this._bunRouter = new BunRouter({
      verbose: !isProduction,
      // Disable bun-router's path prefixing since stacks manages its own prefixes
      apiPrefix: '',
      webPrefix: '',
    })
  }

  /**
   * Wait for all pending route registrations to complete
   */
  async waitForRoutes(): Promise<void> {
    if (this._pendingRoutes.length > 0) {
      await Promise.all(this._pendingRoutes)
      this._pendingRoutes = []
    }
  }

  /**
   * Get the underlying bun-router instance
   */
  get bunRouter(): BunRouter {
    return this._bunRouter
  }

  // Method to update cache buster when files change
  public static updateCacheBuster(): void {
    const isProduction = process.env.APP_ENV === 'production' || process.env.APP_ENV === 'prod'
    if (!isProduction) {
      globalThis.__cacheBuster = Date.now()
      log.debug('Updated cache buster timestamp')
    }
  }

  // Helper to get cache busting query parameter
  private getCacheBuster(): string {
    const isProduction = process.env.APP_ENV === 'production' || process.env.APP_ENV === 'prod'
    if (!isProduction) {
      return `?t=${globalThis.__cacheBuster}`
    }
    return ''
  }

  private async addRouteAsync(
    method: Route['method'],
    uri: string,
    callback: Route['callback'] | string,
    statusCode: StatusCode,
  ): Promise<this> {
    const name = uri.replace(/\//g, '.').replace(/\{/g, '').replace(/\}/g, '')
    const pattern = new RegExp(
      `^${uri.replace(/\{[a-z]+\}/gi, (_match) => {
        return '([a-zA-Z0-9-]+)'
      })}$`,
    )

    log.debug(`Adding route: ${method} ${uri} with name ${name}`)

    // Store in stacks routes for compatibility
    this.stacksRoutes.push({
      name,
      method,
      url: uri,
      uri,
      callback,
      pattern,
      statusCode,
      paramNames: [],
    })

    // Register with bun-router using a wrapper handler
    const wrappedHandler = async (req: EnhancedRequest) => {
      return this.executeHandler(callback, req, statusCode)
    }

    // Register route with bun-router based on method - awaiting the async calls
    switch (method) {
      case 'GET':
        await this._bunRouter.get(uri, wrappedHandler, 'api', name)
        break
      case 'POST':
        await this._bunRouter.post(uri, wrappedHandler, 'api', name)
        break
      case 'PUT':
        await this._bunRouter.put(uri, wrappedHandler, 'api', name)
        break
      case 'PATCH':
        await this._bunRouter.patch(uri, wrappedHandler, 'api', name)
        break
      case 'DELETE':
        await this._bunRouter.delete(uri, wrappedHandler, 'api', name)
        break
    }

    return this
  }

  // Sync wrapper for backwards compatibility with chaining
  private addRoute(
    method: Route['method'],
    uri: string,
    callback: Route['callback'] | string,
    statusCode: StatusCode,
  ): this {
    // Track the pending promise so we can wait for all routes to be registered
    const promise = this.addRouteAsync(method, uri, callback, statusCode)
    this._pendingRoutes.push(promise)
    return this
  }

  /**
   * Execute a handler (string path, function, or promise)
   */
  private async executeHandler(
    callback: Route['callback'] | string,
    req: EnhancedRequest,
    _statusCode: StatusCode,
  ): Promise<Response> {
    try {
      // If it's a string, resolve it as an Action or Controller path
      if (typeof callback === 'string') {
        return await this.resolveStringHandler(callback, req)
      }

      // If it's a function, call it directly with the enhanced request
      if (typeof callback === 'function') {
        const result = await callback(req)

        // If result is already a Response, return it
        if (result instanceof Response) {
          return result
        }

        // If result is a properly formatted response object
        if (
          isObject(result)
          && 'status' in result
          && typeof result.status === 'number'
          && 'headers' in result
          && isObject(result.headers)
          && 'body' in result
        ) {
          return new Response(result.body, {
            status: result.status,
            headers: result.headers as HeadersInit,
          })
        }

        // If it's a JSON-like object, return as JSON
        if (isObject(result)) {
          return Response.json(result)
        }

        // For other types (string, number, etc), return as text
        return new Response(String(result))
      }

      // If it's a promise, resolve it
      if (callback instanceof Promise) {
        const actionModule = await callback
        if (actionModule.default && typeof actionModule.default.handle === 'function') {
          const result = await actionModule.default.handle(req)
          if (result instanceof Response) {
            return result
          }
          return Response.json(result)
        }
      }

      return new Response('Invalid handler', { status: 500 })
    }
    catch (error: any) {
      log.error('Route handler error:', error)

      if (error.status === 422) {
        return Response.json(JSON.parse(error.message), { status: 422 })
      }

      return Response.json({ error: error.message || 'Internal server error' }, { status: error.status || 500 })
    }
  }

  /**
   * Resolve a string handler (Action or Controller path)
   */
  private async resolveStringHandler(callbackPath: string, req: EnhancedRequest): Promise<Response> {
    let modulePath = callbackPath
    let importPathFunction = p.appPath

    if (callbackPath.startsWith('../'))
      importPathFunction = p.routesPath
    if (modulePath.includes('OrmAction'))
      importPathFunction = p.storagePath

    // Remove trailing .ts if present
    modulePath = modulePath.endsWith('.ts') ? modulePath.slice(0, -3) : modulePath

    let requestInstance: RequestInstance = await extractDefaultRequest()

    try {
      // Handle controller-based routing
      if (modulePath.includes('Controller')) {
        const [controllerPath, methodName = 'index'] = modulePath.split('@')

        const controllerPathWithCacheBuster = importPathFunction(controllerPath) + this.getCacheBuster()
        const controller = await import(controllerPathWithCacheBuster)
        // eslint-disable-next-line new-cap
        const instance = new controller.default()

        if (typeof instance[methodName] !== 'function')
          throw new Error(`Method ${methodName} not found in controller ${controllerPath}`)

        const result = await instance[methodName](requestInstance)

        if (result instanceof Response) {
          return result
        }

        if (
          isObject(result)
          && 'status' in result
          && typeof result.status === 'number'
          && 'headers' in result
          && isObject(result.headers)
          && 'body' in result
        ) {
          return new Response(result.body, {
            status: result.status,
            headers: result.headers as HeadersInit,
          })
        }

        if (isObject(result)) {
          return Response.json(result)
        }

        return new Response(String(result))
      }

      // Handle action-based routing
      let actionModule = null

      if (modulePath.includes('storage/framework/orm'))
        actionModule = await import(modulePath + this.getCacheBuster())
      else if (modulePath.includes('Actions'))
        actionModule = await import(p.projectPath(`app/${modulePath}.ts`) + this.getCacheBuster())
      else if (modulePath.includes('OrmAction'))
        actionModule = await import(p.storagePath(`/framework/actions/src/${modulePath}.ts`) + this.getCacheBuster())
      else
        actionModule = await import(importPathFunction(modulePath) + this.getCacheBuster())

      if (actionModule.default.model)
        requestInstance = await findRequestInstanceFromAction(actionModule.default.model)
      else
        requestInstance = await extractDefaultRequest()

      if (isObjectNotEmpty(actionModule.default.validations) && requestInstance)
        await customValidate(actionModule.default.validations, requestInstance.all())

      const result = await actionModule.default.handle(requestInstance)

      if (result instanceof Response) {
        return result
      }

      if (
        isObject(result)
        && 'status' in result
        && typeof result.status === 'number'
        && 'headers' in result
        && isObject(result.headers)
        && 'body' in result
      ) {
        return new Response(result.body, {
          status: result.status,
          headers: result.headers as HeadersInit,
        })
      }

      if (isObject(result)) {
        return Response.json(result)
      }

      return new Response(String(result))
    }
    catch (error: any) {
      if (error.status === 422)
        return Response.json(JSON.parse(error.message), { status: 422 })

      if (!error.status)
        return Response.json({ error: error.message }, { status: 500 })

      return Response.json({ error: error.message }, { status: error.status })
    }
  }

  public get(path: Route['url'], callback: Route['callback']): this {
    this.path = this.normalizePath(path)
    log.debug(`Normalized Path: ${this.path}`)

    const uri = this.prepareUri(this.path)
    log.debug(`Prepared URI: ${uri}`)

    // If callback is a string and ends with .html, treat it as a view
    if (typeof callback === 'string' && callback.endsWith('.html')) {
      staticRoute.addHtmlFile(uri, callback)
      return this.addRoute('GET', uri, async () => callback, 200)
    }

    return this.addRoute('GET', uri, callback, 200)
  }

  public async email(path: Route['url']): Promise<this> {
    path = pascalCase(path)

    const emailModule = (await import(p.userNotificationsPath(path))).default as Action
    const callback = emailModule.handle
    const uri = this.prepareUri(path)
    this.addRoute('GET', uri, callback, 200)

    return this
  }

  public async health(): Promise<this> {
    let healthPath = p.userActionsPath('HealthAction')

    if (!fs.existsSync(healthPath))
      healthPath = p.storagePath('framework/defaults/actions/HealthAction')

    const healthModule = (await import(healthPath)).default as Action

    const callback = healthModule.handle
    const path = healthModule.path ?? `/health`

    this.addRoute('GET', path, callback, 200)

    return this
  }

  public async job(path: Route['url']): Promise<this> {
    path = pascalCase(path)

    const job = (await import(p.userJobsPath(`${path}.ts`))).default as Job

    if (!job.handle) {
      handleError(`Job at path ${path} does not have a handle method`)
      return this
    }

    return this.addRoute('GET', this.prepareUri(path), job.handle, 200)
  }

  public async action(path: ActionPath | Route['path']): Promise<this> {
    if (!path)
      return this

    if (path?.endsWith('.ts')) {
      const action = (await import(p.userActionsPath(path))).default as Action
      path = action.path ?? kebabCase(path as string)
      return this.addRoute(action.method ?? 'GET', path, action.handle, 200)
    }

    path = pascalCase(path)

    try {
      const action = (await import(p.userActionsPath(path))).default as Action

      return this.addRoute(action.method ?? 'GET', this.prepareUri(path), action.handle, 200)
    }
    catch (error) {
      handleError(`Could not find Action for path: ${path}`, error)

      return this
    }
  }

  public post(path: Route['url'], callback: Route['callback']): this {
    this.path = this.normalizePath(path)

    const uri = this.prepareUri(this.path)

    return this.addRoute('POST', uri, callback, 201)
  }

  public view(path: Route['url'], htmlFile: any): this {
    this.path = this.normalizePath(path)
    const uri = this.prepareUri(this.path)

    staticRoute.addHtmlFile(uri, htmlFile)

    return this.addRoute('GET', uri, async () => htmlFile, 200)
  }

  public getStaticConfig(): Record<string, any> {
    return staticRoute.getStaticConfig()
  }

  public redirect(path: Route['url'], callback: Route['callback'], _status?: RedirectCode): this {
    return this.addRoute('GET', path, callback, 302)
  }

  public delete(path: Route['url'], callback: Route['callback']): this {
    return this.addRoute('DELETE', this.prepareUri(path), callback, 204)
  }

  public patch(path: Route['url'], callback: Route['callback']): this {
    this.path = this.normalizePath(path)
    log.debug(`Normalized Path: ${this.path}`)

    const uri = this.prepareUri(this.path)
    log.debug(`Prepared URI: ${uri}`)

    return this.addRoute('PATCH', uri, callback, 202)
  }

  public put(path: Route['url'], callback: Route['callback']): this {
    this.path = this.normalizePath(path)

    const uri = this.prepareUri(this.path)

    return this.addRoute('PUT', uri, callback, 202)
  }

  public group(options: string | RouteGroupOptions, callback?: () => void): this {
    if (typeof options === 'string')
      options = options.startsWith('/') ? options.slice(1) : options

    let cb: () => void

    if (typeof options === 'function') {
      cb = options
      options = {}
    }

    if (!callback)
      throw new Error('Missing callback function for your route group.')

    cb = callback

    const { middleware = [] } = options as RouteGroupOptions

    // Save a reference to the original routes array
    const originalRoutes = this.stacksRoutes

    // Create a new routes array for the duration of the callback
    this.stacksRoutes = []

    // Execute the callback
    cb()

    if (typeof options === 'object') {
      this.stacksRoutes.forEach((r) => {
        if (middleware.length)
          r.middleware = middleware

        const prefix = options.prefix || '/'
        const formattedPrefix = prefix.startsWith('/') ? prefix : `/${prefix}`

        if (options.prefix) {
          r.path = formattedPrefix + r.uri
          r.uri = formattedPrefix + r.uri
          r.url = r.uri
        }

        originalRoutes.push(r)

        return this
      })
    }

    this.stacksRoutes = originalRoutes

    return this
  }

  public name(name: string): this {
    this.stacksRoutes[this.stacksRoutes.length - 1].name = name

    return this
  }

  public middleware(middleware: Route['middleware']): this {
    this.stacksRoutes[this.stacksRoutes.length - 1].middleware = middleware

    return this
  }

  public prefix(prefix: string): this {
    this.stacksRoutes[this.stacksRoutes.length - 1].prefix = prefix

    return this
  }

  public async getRoutes(): Promise<Route[]> {
    await this.importRoutes()

    return this.stacksRoutes
  }

  public async importRoutes(): Promise<void> {
    // Skip dynamic imports in production if routes are already loaded
    if (this.stacksRoutes.length > 0) {
      log.debug(`Routes already loaded via static import. Total routes: ${this.stacksRoutes.length}`)
      return
    }

    try {
      const userRoutesPath = p.routesPath('api.ts')
      const ormRoutesPath = p.frameworkPath('core/orm/routes.ts')

      log.debug(`Importing user routes from: ${userRoutesPath}`)
      log.debug(`Importing ORM routes from: ${ormRoutesPath}`)

      await import(userRoutesPath)
      await import(ormRoutesPath)

      log.debug(`Routes imported successfully. Total routes: ${this.stacksRoutes.length}`)
    }
    catch (error) {
      log.error('Failed to import routes:', error)
      try {
        await import('../../../../../routes/api')
        await import('../../../orm/routes')
      }
      catch (fallbackError) {
        log.error('Fallback route import also failed:', fallbackError)
      }
    }
  }

  public async resolveCallback(callback: Route['callback']): Promise<Route['callback']> {
    if (callback instanceof Promise) {
      const actionModule = await callback
      return actionModule.default
    }

    if (typeof callback === 'string')
      return await this.importCallbackFromPath(callback, this.path)

    return callback
  }

  public async importCallbackFromPath(callbackPath: string, originalPath: string): Promise<Route['callback']> {
    let modulePath = callbackPath
    let importPathFunction = p.appPath

    if (callbackPath.startsWith('../'))
      importPathFunction = p.routesPath
    if (modulePath.includes('OrmAction'))
      importPathFunction = p.storagePath

    modulePath = modulePath.endsWith('.ts') ? modulePath.slice(0, -3) : modulePath

    let requestInstance: RequestInstance = await extractDefaultRequest()

    try {
      if (modulePath.includes('Controller')) {
        const [controllerPath, methodName = 'index'] = modulePath.split('@')

        const controllerPathWithCacheBuster = importPathFunction(controllerPath) + this.getCacheBuster()

        const controller = await import(controllerPathWithCacheBuster)
        // eslint-disable-next-line new-cap
        const instance = new controller.default()

        if (typeof instance[methodName] !== 'function')
          throw new Error(`Method ${methodName} not found in controller ${controllerPath}`)

        const newPath = controller.default.path ?? originalPath
        this.updatePathIfNeeded(newPath, originalPath)

        const result = await instance[methodName](requestInstance)

        if (
          isObject(result)
          && 'status' in result
          && typeof result.status === 'number'
          && 'headers' in result
          && isObject(result.headers)
          && 'body' in result
        ) {
          return result
        }

        if (isObject(result)) {
          return response.json(result)
        }

        return response.success(result)
      }

      let actionModule = null

      if (modulePath.includes('storage/framework/orm'))
        actionModule = await import(modulePath + this.getCacheBuster())
      else if (modulePath.includes('Actions'))
        actionModule = await import(p.projectPath(`app/${modulePath}.ts`) + this.getCacheBuster())
      else if (modulePath.includes('OrmAction'))
        actionModule = await import(p.storagePath(`/framework/actions/src/${modulePath}.ts`) + this.getCacheBuster())
      else
        actionModule = await import(importPathFunction(modulePath) + this.getCacheBuster())

      const newPath = actionModule.default.path ?? originalPath
      this.updatePathIfNeeded(newPath, originalPath)

      if (actionModule.default.model)
        requestInstance = await findRequestInstanceFromAction(actionModule.default.model)
      else
        requestInstance = await extractDefaultRequest()

      if (isObjectNotEmpty(actionModule.default.validations) && requestInstance)
        await customValidate(actionModule.default.validations, requestInstance.all())

      const result = await actionModule.default.handle(requestInstance)

      if (
        isObject(result)
        && 'status' in result
        && typeof result.status === 'number'
        && 'headers' in result
        && isObject(result.headers)
        && 'body' in result
      ) {
        return result
      }

      if (isObject(result)) {
        return response.json(result)
      }

      return response.success(result)
    }
    catch (error: any) {
      if (error.status === 422)
        return response.json(JSON.parse(error.message), 422)

      if (!error.status)
        return response.error(error.message)

      return response.error(error.message, error.status)
    }
  }

  private normalizePath(path: string): string {
    return path.endsWith('/') ? path.slice(0, -1) : path
  }

  public prepareUri(path: string): string {
    if (path.startsWith('/'))
      path = path.slice(1)

    path = `/${path}`

    return path.endsWith('/') ? path.slice(0, -1) : path
  }

  private updatePathIfNeeded(newPath: string, originalPath: string): void {
    if (newPath !== originalPath) {
      this.path = newPath
    }
  }
}

// Singleton router instance - initialized immediately and stored on globalThis
// This ensures it's available even when bundler reorders imports
const _router = new Router()

// Store on globalThis for compiled binary compatibility
if (typeof globalThis !== 'undefined') {
  ;(globalThis as any).__STACKS_ROUTER__ = _router
}

// Export the router instance
export const route: Router = _router

// Helper function to get the router from globalThis (for compiled binary mode)
export function getRouter(): Router {
  if (typeof globalThis !== 'undefined' && (globalThis as any).__STACKS_ROUTER__) {
    return (globalThis as any).__STACKS_ROUTER__
  }
  return _router
}
