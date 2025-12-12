import type { Action } from '@stacksjs/actions'
import type { Job, RedirectCode, RequestInstance, Route as StacksRoute, RouteGroupOptions, RouterInterface, StatusCode } from '@stacksjs/types'
import type { EnhancedRequest, MiddlewareHandler, Route, RouterConfig } from 'bun-router'
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
 * Stacks Router Configuration extending bun-router's config
 */
export interface StacksRouterConfig extends Partial<RouterConfig> {
  /** Enable verbose logging in development */
  verbose?: boolean
  /** Base path for API routes */
  apiPrefix?: string
  /** Base path for web routes */
  webPrefix?: string
}

/**
 * StacksRouter - A comprehensive router built on top of bun-router
 *
 * Provides all bun-router functionality plus Stacks-specific features:
 * - Action/Controller-based routing with string path resolution
 * - ORM integration for model-based routes
 * - Automatic request validation
 * - File upload handling
 * - Static file serving
 * - Route grouping with middleware
 */
export class StacksRouter implements RouterInterface {
  /** Internal bun-router instance */
  private _bunRouter: BunRouter

  /** Stacks route registry for backwards compatibility */
  private _stacksRoutes: StacksRoute[] = []

  /** Current path context for route building */
  private _currentPath = ''

  /** Pending route registrations */
  private _pendingRoutes: Promise<any>[] = []

  /** Current group prefix */
  private _groupPrefix = ''

  /** Current group middleware */
  private _groupMiddleware: MiddlewareHandler[] = []

  constructor(config: StacksRouterConfig = {}) {
    this._bunRouter = new BunRouter({
      verbose: config.verbose ?? !isProduction,
      apiPrefix: config.apiPrefix ?? '',
      webPrefix: config.webPrefix ?? '',
      ...config,
    })
  }

  // ============================================================================
  // BUN-ROUTER PASSTHROUGH METHODS
  // ============================================================================

  /**
   * Get the underlying bun-router instance for direct access to all features
   */
  get bunRouter(): BunRouter {
    return this._bunRouter
  }

  /**
   * Get all registered routes from bun-router
   */
  get routes(): Route[] {
    return this._bunRouter.routes
  }

  /**
   * Handle an incoming request using bun-router
   */
  async handleRequest(req: Request): Promise<Response> {
    return this._bunRouter.handleRequest(req)
  }

  /**
   * Start the server using bun-router's serve method
   */
  async serve(options?: { port?: number; hostname?: string }) {
    return this._bunRouter.serve(options)
  }

  /**
   * Register global middleware
   */
  async use(...middleware: (string | MiddlewareHandler)[]): Promise<this> {
    await this._bunRouter.use(...middleware)
    return this
  }

  /**
   * Create a middleware group
   */
  middlewareGroup(name: string, middlewareNames: string[]): this {
    this._bunRouter.middlewareGroup(name, middlewareNames)
    return this
  }

  /**
   * Generate URL for a named route
   */
  route(name: string, params?: Record<string, string | number>): string {
    return this._bunRouter.route(name, params)
  }

  /**
   * Set global error handler
   */
  onError(handler: (error: Error, request: EnhancedRequest) => Response | Promise<Response>): this {
    this._bunRouter.onError(handler)
    return this
  }

  /**
   * Set fallback handler for unmatched routes
   */
  fallback(handler: (request: EnhancedRequest) => Response | Promise<Response>): this {
    this._bunRouter.fallback(handler)
    return this
  }

  // ============================================================================
  // CACHE BUSTING (Development)
  // ============================================================================

  /**
   * Update cache buster timestamp (for HMR in development)
   */
  static updateCacheBuster(): void {
    if (!isProduction) {
      globalThis.__cacheBuster = Date.now()
      log.debug('Updated cache buster timestamp')
    }
  }

  private getCacheBuster(): string {
    // NOTE: Bun doesn't support query strings in dynamic imports like browsers/Vite do.
    // The cache buster was causing ENOENT errors because Bun treats the query string
    // as part of the filename. In development, Bun's loader already handles HMR differently.
    // For now, we disable the cache buster until a Bun-compatible solution is found.
    return ''
  }

  // ============================================================================
  // ROUTE REGISTRATION METHODS
  // ============================================================================

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
   * Internal method to add a route with Stacks handler resolution
   */
  private async addRouteAsync(
    method: StacksRoute['method'],
    uri: string,
    callback: StacksRoute['callback'] | string,
    statusCode: StatusCode,
    explicitPrefix?: string,
  ): Promise<this> {
    // Use explicit prefix if provided, otherwise use current group prefix
    const prefix = explicitPrefix !== undefined ? explicitPrefix : this._groupPrefix
    const fullUri = prefix ? `${prefix}${uri}` : uri
    const name = fullUri.replace(/\//g, '.').replace(/\{/g, '').replace(/\}/g, '').replace(/^\./, '')
    const pattern = new RegExp(
      `^${fullUri.replace(/\{[a-z]+\}/gi, () => '([a-zA-Z0-9-]+)')}$`,
    )

    log.debug(`Adding route: ${method} ${fullUri} with name ${name}`)

    // Store in stacks routes for compatibility
    this._stacksRoutes.push({
      name,
      method,
      url: fullUri,
      uri: fullUri,
      callback,
      pattern,
      statusCode,
      paramNames: [],
      middleware: this._groupMiddleware.length > 0 ? [...this._groupMiddleware] : undefined,
    })

    // Create wrapped handler that resolves Stacks callbacks
    const wrappedHandler = async (req: EnhancedRequest): Promise<Response> => {
      return this.executeHandler(callback, req, statusCode)
    }

    // Get middleware for this route
    const routeMiddleware = this._groupMiddleware.length > 0 ? [...this._groupMiddleware] : undefined

    // Register with bun-router
    const routeType = fullUri.startsWith('/api') ? 'api' : 'web'
    switch (method) {
      case 'GET':
        await this._bunRouter.get(fullUri, wrappedHandler, routeType, name, routeMiddleware)
        break
      case 'POST':
        await this._bunRouter.post(fullUri, wrappedHandler, routeType, name, routeMiddleware)
        break
      case 'PUT':
        await this._bunRouter.put(fullUri, wrappedHandler, routeType, name, routeMiddleware)
        break
      case 'PATCH':
        await this._bunRouter.patch(fullUri, wrappedHandler, routeType, name, routeMiddleware)
        break
      case 'DELETE':
        await this._bunRouter.delete(fullUri, wrappedHandler, routeType, name, routeMiddleware)
        break
      case 'OPTIONS':
        await this._bunRouter.options(fullUri, wrappedHandler, routeType, name, routeMiddleware)
        break
    }

    return this
  }

  /**
   * Synchronous wrapper for route registration (maintains chaining API)
   * Captures the current group prefix at call time for async safety
   */
  private addRoute(
    method: StacksRoute['method'],
    uri: string,
    callback: StacksRoute['callback'] | string,
    statusCode: StatusCode,
  ): this {
    // Capture the current prefix at call time to handle async groups correctly
    const capturedPrefix = this._groupPrefix
    const promise = this.addRouteAsync(method, uri, callback, statusCode, capturedPrefix)
    this._pendingRoutes.push(promise)
    return this
  }

  // ============================================================================
  // HTTP METHOD SHORTCUTS
  // ============================================================================

  /**
   * Register a GET route
   */
  get(path: StacksRoute['url'], callback: StacksRoute['callback']): this {
    this._currentPath = this.normalizePath(path)
    const uri = this.prepareUri(this._currentPath)

    // Handle HTML view routes
    if (typeof callback === 'string' && callback.endsWith('.html')) {
      staticRoute.addHtmlFile(uri, callback)
      return this.addRoute('GET', uri, async () => callback, 200)
    }

    return this.addRoute('GET', uri, callback, 200)
  }

  /**
   * Register a POST route
   */
  post(path: StacksRoute['url'], callback: StacksRoute['callback']): this {
    this._currentPath = this.normalizePath(path)
    const uri = this.prepareUri(this._currentPath)
    return this.addRoute('POST', uri, callback, 201)
  }

  /**
   * Register a PUT route
   */
  put(path: StacksRoute['url'], callback: StacksRoute['callback']): this {
    this._currentPath = this.normalizePath(path)
    const uri = this.prepareUri(this._currentPath)
    return this.addRoute('PUT', uri, callback, 202)
  }

  /**
   * Register a PATCH route
   */
  patch(path: StacksRoute['url'], callback: StacksRoute['callback']): this {
    this._currentPath = this.normalizePath(path)
    const uri = this.prepareUri(this._currentPath)
    return this.addRoute('PATCH', uri, callback, 202)
  }

  /**
   * Register a DELETE route
   */
  delete(path: StacksRoute['url'], callback: StacksRoute['callback']): this {
    const uri = this.prepareUri(path)
    return this.addRoute('DELETE', uri, callback, 204)
  }

  /**
   * Register an OPTIONS route
   */
  options(path: StacksRoute['url'], callback: StacksRoute['callback']): this {
    const uri = this.prepareUri(path)
    return this.addRoute('OPTIONS', uri, callback, 200)
  }

  /**
   * Register a route that matches any HTTP method
   */
  any(path: StacksRoute['url'], callback: StacksRoute['callback']): this {
    const methods: StacksRoute['method'][] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
    const uri = this.prepareUri(path)
    for (const method of methods) {
      this.addRoute(method, uri, callback, 200)
    }
    return this
  }

  /**
   * Register a route that matches specific HTTP methods
   */
  match(methods: StacksRoute['method'][], path: StacksRoute['url'], callback: StacksRoute['callback']): this {
    const uri = this.prepareUri(path)
    for (const method of methods) {
      this.addRoute(method, uri, callback, 200)
    }
    return this
  }

  // ============================================================================
  // STACKS-SPECIFIC ROUTE TYPES
  // ============================================================================

  /**
   * Register a view route (serves HTML file)
   */
  view(path: StacksRoute['url'], htmlFile: string): this {
    this._currentPath = this.normalizePath(path)
    const uri = this.prepareUri(this._currentPath)
    staticRoute.addHtmlFile(uri, htmlFile)
    return this.addRoute('GET', uri, async () => htmlFile, 200)
  }

  /**
   * Register an email notification route
   */
  async email(path: StacksRoute['url']): Promise<this> {
    const pascalPath = pascalCase(path)
    const emailModule = (await import(p.userNotificationsPath(pascalPath))).default as Action
    const callback = emailModule.handle
    const uri = this.prepareUri(pascalPath)
    this.addRoute('GET', uri, callback, 200)
    return this
  }

  /**
   * Register a health check endpoint
   */
  async health(): Promise<this> {
    let healthPath = p.userActionsPath('HealthAction')

    if (!fs.existsSync(healthPath)) {
      healthPath = p.storagePath('framework/defaults/actions/HealthAction')
    }

    const healthModule = (await import(healthPath)).default as Action
    const callback = healthModule.handle
    const path = healthModule.path ?? '/health'

    this.addRoute('GET', path, callback, 200)
    return this
  }

  /**
   * Register a job route
   */
  async job(path: StacksRoute['url']): Promise<this> {
    const pascalPath = pascalCase(path)
    const job = (await import(p.userJobsPath(`${pascalPath}.ts`))).default as Job

    if (!job.handle) {
      handleError(`Job at path ${path} does not have a handle method`)
      return this
    }

    return this.addRoute('GET', this.prepareUri(pascalPath), job.handle, 200)
  }

  /**
   * Register an action route
   */
  async action(path: ActionPath | StacksRoute['path']): Promise<this> {
    if (!path) return this

    if (path?.endsWith('.ts')) {
      const action = (await import(p.userActionsPath(path))).default as Action
      const actionPath = action.path ?? kebabCase(path as string)
      return this.addRoute(action.method ?? 'GET', actionPath, action.handle, 200)
    }

    const pascalPath = pascalCase(path)

    try {
      const action = (await import(p.userActionsPath(pascalPath))).default as Action
      return this.addRoute(action.method ?? 'GET', this.prepareUri(pascalPath), action.handle, 200)
    }
    catch (error) {
      handleError(`Could not find Action for path: ${path}`, error)
      return this
    }
  }

  /**
   * Register a redirect route
   */
  redirect(path: StacksRoute['url'], callback: StacksRoute['callback'], _status?: RedirectCode): this {
    return this.addRoute('GET', path, callback, 302)
  }

  // ============================================================================
  // ROUTE GROUPING
  // ============================================================================

  /**
   * Create a route group with shared attributes
   * Supports both sync and async callbacks
   *
   * The prefix is captured synchronously when routes are registered via addRoute(),
   * so async callbacks work correctly.
   */
  group(options: string | RouteGroupOptions, callback?: (() => void) | (() => Promise<void>)): this {
    // Handle string prefix shorthand
    if (typeof options === 'string') {
      options = { prefix: options.startsWith('/') ? options.slice(1) : options }
    }

    // Handle function-only call
    let cb: (() => void) | (() => Promise<void>)
    if (typeof options === 'function') {
      cb = options
      options = {}
    }
    else if (!callback) {
      throw new Error('Missing callback function for your route group.')
    }
    else {
      cb = callback
    }

    const { prefix = '', middleware = [] } = options as RouteGroupOptions

    // Save current state
    const previousPrefix = this._groupPrefix
    const previousMiddleware = [...this._groupMiddleware]

    // Set new group state - routes registered synchronously within cb() will
    // capture this prefix via addRoute() before it changes
    const formattedPrefix = prefix ? (prefix.startsWith('/') ? prefix : `/${prefix}`) : ''
    this._groupPrefix = previousPrefix + formattedPrefix
    this._groupMiddleware = [...previousMiddleware, ...middleware]

    // Execute callback - route registrations inside will synchronously
    // capture the current _groupPrefix value
    const result = cb()

    // If callback returns a promise, track it for later awaiting
    if (result instanceof Promise) {
      this._pendingRoutes.push(result)
    }

    // Restore previous state immediately
    // Routes have already captured their prefixes in addRoute()
    this._groupPrefix = previousPrefix
    this._groupMiddleware = previousMiddleware

    return this
  }

  // ============================================================================
  // ROUTE METADATA (Chaining)
  // ============================================================================

  /**
   * Set name for the last registered route
   */
  name(name: string): this {
    if (this._stacksRoutes.length > 0) {
      this._stacksRoutes[this._stacksRoutes.length - 1].name = name
    }
    return this
  }

  /**
   * Set middleware for the last registered route
   * Accepts a string name, array of strings, or middleware handlers
   */
  middleware(middleware: string | string[] | StacksRoute['middleware']): this {
    if (this._stacksRoutes.length > 0) {
      // Normalize to array if single string
      const normalizedMiddleware = typeof middleware === 'string' ? [middleware] : middleware
      this._stacksRoutes[this._stacksRoutes.length - 1].middleware = normalizedMiddleware
    }
    return this
  }

  /**
   * Set prefix for the last registered route
   */
  prefix(prefix: string): this {
    if (this._stacksRoutes.length > 0) {
      this._stacksRoutes[this._stacksRoutes.length - 1].prefix = prefix
    }
    return this
  }

  // ============================================================================
  // ROUTE RETRIEVAL
  // ============================================================================

  /**
   * Get all registered Stacks routes
   */
  async getRoutes(): Promise<StacksRoute[]> {
    await this.importRoutes()
    return this._stacksRoutes
  }

  /**
   * Import route definitions from route files
   */
  async importRoutes(): Promise<void> {
    // Skip if routes already loaded
    if (this._stacksRoutes.length > 0) {
      log.debug(`Routes already loaded. Total routes: ${this._stacksRoutes.length}`)
      return
    }

    try {
      const userRoutesPath = p.routesPath('api.ts')
      const ormRoutesPath = p.frameworkPath('core/orm/routes.ts')

      log.debug(`Importing user routes from: ${userRoutesPath}`)
      log.debug(`Importing ORM routes from: ${ormRoutesPath}`)

      await import(userRoutesPath)
      await import(ormRoutesPath)

      log.debug(`Routes imported successfully. Total routes: ${this._stacksRoutes.length}`)
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

  /**
   * Get static route configuration
   */
  getStaticConfig(): Record<string, any> {
    return staticRoute.getStaticConfig()
  }

  // ============================================================================
  // HANDLER EXECUTION
  // ============================================================================

  /**
   * Execute a handler (string path, function, or promise)
   */
  private async executeHandler(
    callback: StacksRoute['callback'] | string,
    req: EnhancedRequest,
    _statusCode: StatusCode,
  ): Promise<Response> {
    try {
      // String path - resolve as Action or Controller
      if (typeof callback === 'string') {
        return await this.resolveStringHandler(callback, req)
      }

      // Function handler
      if (typeof callback === 'function') {
        const result = await callback(req)

        if (result instanceof Response) {
          return result
        }

        // Properly formatted response object
        if (isObject(result) && 'status' in result && typeof result.status === 'number' && 'headers' in result && isObject(result.headers) && 'body' in result) {
          return new Response(result.body, {
            status: result.status,
            headers: result.headers as HeadersInit,
          })
        }

        // JSON-like object
        if (isObject(result)) {
          return Response.json(result)
        }

        // Primitive types (string, number, boolean)
        return new Response(String(result), {
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        })
      }

      // Promise (lazy-loaded module)
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

      return Response.json(
        { error: error.message || 'Internal server error' },
        { status: error.status || 500 },
      )
    }
  }

  /**
   * Resolve a string handler (Action or Controller path)
   */
  private async resolveStringHandler(callbackPath: string, req: EnhancedRequest): Promise<Response> {
    let modulePath = callbackPath
    let importPathFunction = p.appPath

    if (callbackPath.startsWith('../')) importPathFunction = p.routesPath
    if (modulePath.includes('OrmAction')) importPathFunction = p.storagePath

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

        if (typeof instance[methodName] !== 'function') {
          throw new Error(`Method ${methodName} not found in controller ${controllerPath}`)
        }

        const result = await instance[methodName](requestInstance)
        return this.formatHandlerResult(result)
      }

      // Handle action-based routing
      let actionModule = null

      if (modulePath.includes('storage/framework/orm')) {
        actionModule = await import(modulePath + this.getCacheBuster())
      }
      else if (modulePath.includes('Actions')) {
        actionModule = await import(p.projectPath(`app/${modulePath}.ts`) + this.getCacheBuster())
      }
      else if (modulePath.includes('OrmAction')) {
        actionModule = await import(p.storagePath(`/framework/actions/src/${modulePath}.ts`) + this.getCacheBuster())
      }
      else {
        actionModule = await import(importPathFunction(modulePath) + this.getCacheBuster())
      }

      // Get request instance based on model
      if (actionModule.default.model) {
        requestInstance = await findRequestInstanceFromAction(actionModule.default.model)
      }
      else {
        requestInstance = await extractDefaultRequest()
      }

      // Run validation if defined
      if (isObjectNotEmpty(actionModule.default.validations) && requestInstance) {
        await customValidate(actionModule.default.validations, requestInstance.all())
      }

      const result = await actionModule.default.handle(requestInstance)
      return this.formatHandlerResult(result)
    }
    catch (error: any) {
      if (error.status === 422) {
        return Response.json(JSON.parse(error.message), { status: 422 })
      }

      if (!error.status) {
        return Response.json({ error: error.message }, { status: 500 })
      }

      return Response.json({ error: error.message }, { status: error.status })
    }
  }

  /**
   * Format handler result to Response
   */
  private formatHandlerResult(result: any): Response {
    if (result instanceof Response) {
      return result
    }

    if (isObject(result) && 'status' in result && typeof result.status === 'number' && 'headers' in result && isObject(result.headers) && 'body' in result) {
      log.debug('Creating Response from response-like object with status:', result.status)
      return new Response(result.body, {
        status: result.status,
        headers: result.headers as HeadersInit,
      })
    }

    if (isObject(result)) {
      log.debug('Creating Response.json from object')
      return Response.json(result)
    }

    log.debug('Creating Response from string')
    return new Response(String(result), {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private normalizePath(path: string): string {
    return path.endsWith('/') ? path.slice(0, -1) : path
  }

  prepareUri(path: string): string {
    if (path.startsWith('/')) path = path.slice(1)
    path = `/${path}`

    // Normalize :param syntax to {param} syntax for bun-router compatibility
    path = path.replace(/:(\w+)/g, '{$1}')

    return path.endsWith('/') ? path.slice(0, -1) : path
  }

  /**
   * Resolve a callback from a promise or string path
   */
  async resolveCallback(callback: StacksRoute['callback']): Promise<StacksRoute['callback']> {
    if (callback instanceof Promise) {
      const actionModule = await callback
      return actionModule.default
    }

    if (typeof callback === 'string') {
      return await this.importCallbackFromPath(callback, this._currentPath)
    }

    return callback
  }

  /**
   * Import a callback from a path
   */
  async importCallbackFromPath(callbackPath: string, originalPath: string): Promise<StacksRoute['callback']> {
    let modulePath = callbackPath
    let importPathFunction = p.appPath

    if (callbackPath.startsWith('../')) importPathFunction = p.routesPath
    if (modulePath.includes('OrmAction')) importPathFunction = p.storagePath

    modulePath = modulePath.endsWith('.ts') ? modulePath.slice(0, -3) : modulePath

    let requestInstance: RequestInstance = await extractDefaultRequest()

    try {
      if (modulePath.includes('Controller')) {
        const [controllerPath, methodName = 'index'] = modulePath.split('@')
        const controllerPathWithCacheBuster = importPathFunction(controllerPath) + this.getCacheBuster()
        const controller = await import(controllerPathWithCacheBuster)
        // eslint-disable-next-line new-cap
        const instance = new controller.default()

        if (typeof instance[methodName] !== 'function') {
          throw new Error(`Method ${methodName} not found in controller ${controllerPath}`)
        }

        const newPath = controller.default.path ?? originalPath
        this.updatePathIfNeeded(newPath, originalPath)

        const result = await instance[methodName](requestInstance)

        if (isObject(result) && 'status' in result && typeof result.status === 'number' && 'headers' in result && isObject(result.headers) && 'body' in result) {
          return result
        }

        if (isObject(result)) {
          return response.json(result)
        }

        return response.success(result)
      }

      let actionModule = null

      if (modulePath.includes('storage/framework/orm')) {
        actionModule = await import(modulePath + this.getCacheBuster())
      }
      else if (modulePath.includes('Actions')) {
        actionModule = await import(p.projectPath(`app/${modulePath}.ts`) + this.getCacheBuster())
      }
      else if (modulePath.includes('OrmAction')) {
        actionModule = await import(p.storagePath(`/framework/actions/src/${modulePath}.ts`) + this.getCacheBuster())
      }
      else {
        actionModule = await import(importPathFunction(modulePath) + this.getCacheBuster())
      }

      const newPath = actionModule.default.path ?? originalPath
      this.updatePathIfNeeded(newPath, originalPath)

      if (actionModule.default.model) {
        requestInstance = await findRequestInstanceFromAction(actionModule.default.model)
      }
      else {
        requestInstance = await extractDefaultRequest()
      }

      if (isObjectNotEmpty(actionModule.default.validations) && requestInstance) {
        await customValidate(actionModule.default.validations, requestInstance.all())
      }

      const result = await actionModule.default.handle(requestInstance)

      if (isObject(result) && 'status' in result && typeof result.status === 'number' && 'headers' in result && isObject(result.headers) && 'body' in result) {
        return result
      }

      if (isObject(result)) {
        return response.json(result)
      }

      return response.success(result)
    }
    catch (error: any) {
      if (error.status === 422) return response.json(JSON.parse(error.message), 422)
      if (!error.status) return response.error(error.message)
      return response.error(error.message, error.status)
    }
  }

  private updatePathIfNeeded(newPath: string, originalPath: string): void {
    if (newPath !== originalPath) {
      this._currentPath = newPath
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE & EXPORTS
// ============================================================================

/** Singleton router instance */
const _router = new StacksRouter()

// Store on globalThis for compiled binary compatibility
if (typeof globalThis !== 'undefined') {
  ;(globalThis as any).__STACKS_ROUTER__ = _router
}

/**
 * Default router instance for convenient imports
 */
export const route: StacksRouter = _router

/**
 * Alias for StacksRouter class
 */
export const Router = StacksRouter

/**
 * Get the router from globalThis (for compiled binary mode)
 */
export function getRouter(): StacksRouter {
  if (typeof globalThis !== 'undefined' && (globalThis as any).__STACKS_ROUTER__) {
    return (globalThis as any).__STACKS_ROUTER__
  }
  return _router
}

/**
 * Create a new router instance with custom config
 */
export function createRouter(config?: StacksRouterConfig): StacksRouter {
  return new StacksRouter(config)
}
