import type { Action } from '@stacksjs/actions'
import type { ErrorResponse, Job, RedirectCode, RequestInstance, Route, RouteGroupOptions, RouterInterface, StatusCode } from '@stacksjs/types'
import { db } from '@stacksjs/database'
import { handleError } from '@stacksjs/error-handling'
import { log } from '@stacksjs/logging'
import { path as p } from '@stacksjs/path'
import { kebabCase, pascalCase } from '@stacksjs/strings'
import { customValidate, isObjectNotEmpty } from '@stacksjs/validation'
import { extractDefaultRequest, findRequestInstance } from './utils'

type ActionPath = string

export class Router implements RouterInterface {
  private routes: Route[] = []
  private groupPrefix = ''
  private path = ''

  private addRoute(
    method: Route['method'],
    uri: string,
    callback: Route['callback'] | string | object,
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
    const healthModule = (await import(p.userActionsPath('HealthAction'))).default as Action
    const callback = healthModule.handle
    const path = healthModule.path ?? `/health`

    this.addRoute('GET', path, callback, 200)

    return this
  }

  public async job(path: Route['url']): Promise<this> {
    path = pascalCase(path)

    // removes the potential `JobJob` suffix in case the user does not choose to use the Job suffix in their file name
    const job = (await import(p.userJobsPath(`${path}.ts`))).default as Job

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

  public view(path: Route['url'], callback: Route['callback']): this {
    this.path = this.normalizePath(path)

    const uri = this.prepareUri(this.path)

    return this.addRoute('GET', uri, callback, 200)
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
    await import('../../../../../routes/api') // user routes
    await import('../../../orm/routes') // auto-generated routes

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
    if (this.groupPrefix !== '' && typeof options !== 'string') {
      this.setGroupPrefix(this.groupPrefix, options)
      return
    }

    if (typeof options === 'string') {
      this.setGroupPrefix(options)
      return
    }

    this.setGroupPrefix('', options)
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

    let actionModule = null

    if (modulePath.includes('storage/framework/orm'))
      actionModule = await import(modulePath)
    else if (modulePath.includes('Actions'))
      actionModule = await import(p.projectPath(`app/${modulePath}.ts`))
    else if (modulePath.includes('OrmAction'))
      actionModule = await import(p.storagePath(`/framework/actions/src/${modulePath}.ts`))
    else actionModule = await import(importPathFunction(modulePath))

    // Use custom path from action module if available
    const newPath = actionModule.default.path ?? originalPath
    this.updatePathIfNeeded(newPath, originalPath)

    // we need to make sure the validation happens here
    // to do so, we need to:
    // find the ./app/Models/* file
    // then check via a regex which model attributes validations to utilize by checking what's in between t
    // then validate
    // if succeeds, run the handle
    // if fails, return validation error
    let requestInstance: RequestInstance

    if (actionModule.default.requestFile) {
      requestInstance = await findRequestInstance(actionModule.default.requestFile)
    }
    else {
      requestInstance = await extractDefaultRequest()
    }

    try {
      if (isObjectNotEmpty(actionModule.default.validations) && requestInstance)
        await customValidate(actionModule.default.validations, requestInstance.all())

      return await actionModule.default.handle(requestInstance)
    }
    catch (error: any) {
      const errorResponse = await this.handleErrors(error)

      return errorResponse // or handle it as needed
    }
  }

  private async handleErrors(error: ErrorResponse): Promise<{ status: number, errors: string, stack: string }> {
    // Capture and log the stack trace if available
    const stackTrace = error.stack || 'No stack trace available'

    this.storeError(error)

    this.logError(error)

    // Return structured error response
    if (error.status === 422) {
      return { status: 422, errors: JSON.parse(error.message), stack: stackTrace }
    }

    if (!error.status) {
      return { status: 500, errors: error.message, stack: stackTrace }
    }

    return { status: error.status, errors: error.message, stack: stackTrace }
  }

  private async storeError(error: ErrorResponse): Promise<void> {
    // Capture and log the stack trace if available
    const stackTrace = error.stack || 'No stack trace available'

    await db
      .insertInto('errors')
      .values({
        type: error.name || 'Unknown Error', // Use error name or default to 'Unknown Error'
        message: error.message || 'No message available',
        stack: stackTrace || 'Unkown Stack', // Use stackTrace or null if not available
        status: typeof error.status === 'number' ? error.status : 500, // Ensure status is a number, default to 500
      })
      .execute()
  }

  private async logError(error: ErrorResponse): Promise<void> {
    // Capture and log the stack trace if available
    const stackTrace = error.stack || 'No stack trace available'

    log.debug(stackTrace)
  }

  private normalizePath(path: string): string {
    return path.endsWith('/') ? path.slice(0, -1) : path
  }

  public prepareUri(path: string): string {
    // if string starts with / then remove it because we are adding it back in the next line
    if (path.startsWith('/'))
      path = path.slice(1)

    path = `${this.groupPrefix}/${path}`

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
