import type { Action } from '@stacksjs/actions'
import type { Job, RedirectCode, RequestInstance, Route, RouteGroupOptions, RouterInterface, StatusCode } from '@stacksjs/types'
import { handleError } from '@stacksjs/error-handling'
import { log } from '@stacksjs/logging'
import { path as p } from '@stacksjs/path'
import { fs } from '@stacksjs/storage'
import { kebabCase, pascalCase } from '@stacksjs/strings'
import { customValidate, isObject, isObjectNotEmpty } from '@stacksjs/validation'
import { staticRoute } from './'
import { response } from './response'
import { extractDefaultRequest, findRequestInstanceFromAction } from './utils'

type ActionPath = string

export class Router implements RouterInterface {
  private routes: Route[] = []
  private path = ''

  private addRoute(
    method: Route['method'],
    uri: string,
    callback: Route['callback'] | string,
    statusCode: StatusCode,
  ): this {
    const name = uri.replace(/\//g, '.').replace(/:/g, '') // we can improve this
    const pattern = new RegExp(
      `^${uri.replace(/:[a-z]+/gi, (_match) => {
        return '([a-zA-Z0-9-]+)'
      })}$`,
    )

    // let routeCallback: Route['callback']

    // if (typeof callback === 'string' || typeof callback === 'object') {
    //   // Convert string or object to RouteCallback
    //   routeCallback = () => callback
    // } else {
    //   routeCallback = callback
    // }

    log.debug(`Adding route: ${method} ${uri} with name ${name}`)

    this.routes.push({
      name,
      method,
      url: uri,
      uri,
      callback,
      pattern,
      statusCode,
      paramNames: [],
      // middleware: [],
    })

    return this
  }

  public get(path: Route['url'], callback: Route['callback']): this {
    this.path = this.normalizePath(path)
    log.debug(`Normalized Path: ${this.path}`)

    const uri = this.prepareUri(this.path)
    log.debug(`Prepared URI: ${uri}`)

    // If callback is a string and ends with .html, treat it as a view
    if (typeof callback === 'string' && callback.endsWith('.html')) {
      // Add to static manager
      staticRoute.addHtmlFile(uri, callback)
      // Register as a route for consistency
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

    // check if action is a file anywhere in ./app/Actions/**/*.ts
    if (path?.endsWith('.ts')) {
      // given it ends with .ts, we treat it as an Actions path
      const action = (await import(p.userActionsPath(path))).default as Action
      path = action.path ?? kebabCase(path as string)
      return this.addRoute(action.method ?? 'GET', path, action.handle, 200)
    }

    path = pascalCase(path) // actions are PascalCase

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

    // Add to static manager
    staticRoute.addHtmlFile(uri, htmlFile)

    // Register as a route for consistency
    return this.addRoute('GET', uri, async () => htmlFile, 200)
  }

  // New method to get static configuration
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
    const originalRoutes = this.routes

    // Create a new routes array for the duration of the callback
    this.routes = []

    // Execute the callback. This will add routes to the new this.routes array
    cb()

    if (typeof options === 'object') {
      this.routes.forEach((r) => {
        // Add middleware if any
        if (middleware.length)
          r.middleware = middleware

        // Add the prefix to the route path

        const prefix = options.prefix || '/'
        const formattedPrefix = prefix.startsWith('/') ? prefix : `/${prefix}`

        if (options.prefix) {
          r.path = formattedPrefix + r.uri
          r.uri = formattedPrefix + r.uri
          r.url = r.uri
        }

        // Push the modified route to the original routes array
        originalRoutes.push(r)

        return this
      })
    }

    // Restore the original routes array.
    this.routes = originalRoutes

    return this
  }

  public name(name: string): this {
    this.routes[this.routes.length - 1].name = name

    return this
  }

  public middleware(middleware: Route['middleware']): this {
    this.routes[this.routes.length - 1].middleware = middleware

    return this
  }

  public prefix(prefix: string): this {
    this.routes[this.routes.length - 1].prefix = prefix

    return this
  }

  public async getRoutes(): Promise<Route[]> {
    await this.importRoutes()

    return this.routes
  }

  public async importRoutes(): Promise<void> {
    await import('../../../../../routes/api') // user routes
    await import('../../../orm/routes') // auto-generated routes
  }

  public async resolveCallback(callback: Route['callback']): Promise<Route['callback']> {
    if (callback instanceof Promise) {
      const actionModule = await callback
      return actionModule.default
    }

    if (typeof callback === 'string')
      return await this.importCallbackFromPath(callback, this.path)

    // in this case, the callback ends up being a function
    return callback
  }

  public async importCallbackFromPath(callbackPath: string, originalPath: string): Promise<Route['callback']> {
    let modulePath = callbackPath
    let importPathFunction = p.appPath // Default import path function

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
        const controller = await import(importPathFunction(controllerPath))
        // eslint-disable-next-line new-cap
        const instance = new controller.default()

        if (typeof instance[methodName] !== 'function')
          throw new Error(`Method ${methodName} not found in controller ${controllerPath}`)

        // Use custom path from controller if available
        const newPath = controller.default.path ?? originalPath
        this.updatePathIfNeeded(newPath, originalPath)

        const result = await instance[methodName](requestInstance)

        // Use the same response format checking for controllers
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

        // If it's a JSON-like object, use response.json
        if (isObject(result)) {
          return response.json(result)
        }

        // For other types (string, number, etc), use response.success
        return response.success(result)
      }

      // Handle action-based routing
      let actionModule = null
      if (modulePath.includes('storage/framework/orm'))
        actionModule = await import(modulePath)
      else if (modulePath.includes('Actions'))
        actionModule = await import(p.projectPath(`app/${modulePath}.ts`))
      else if (modulePath.includes('OrmAction'))
        actionModule = await import(p.storagePath(`/framework/actions/src/${modulePath}.ts`))
      else
        actionModule = await import(importPathFunction(modulePath))

      // Use custom path from action module if available
      const newPath = actionModule.default.path ?? originalPath
      this.updatePathIfNeeded(newPath, originalPath)

      if (actionModule.default.model)
        requestInstance = await findRequestInstanceFromAction(actionModule.default.model)
      else
        requestInstance = await extractDefaultRequest()

      // TODO: Check if model name is one of the model names generated by the ORM
      // else
      //   requestInstance = await findRequestInstanceFromAction(getModelFromAction(modulePath))

      if (isObjectNotEmpty(actionModule.default.validations) && requestInstance)
        await customValidate(actionModule.default.validations, requestInstance.all())

      const result = await actionModule.default.handle(requestInstance)

      // Check if result is already a properly formatted response
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

      // If it's a JSON-like object, use response.json
      if (isObject(result)) {
        return response.json(result)
      }

      // For other types (string, number, etc), use response.success
      return response.success(result)
    }
    catch (error: any) {
      // Use the response helper for errors
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
    // if string starts with / then remove it because we are adding it back in the next line
    if (path.startsWith('/'))
      path = path.slice(1)

    path = `/${path}`
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

export const route: Router = new Router()
