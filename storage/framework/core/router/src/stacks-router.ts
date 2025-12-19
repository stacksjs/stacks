/**
 * Stacks Router - Extends bun-router with action/controller resolution
 *
 * This module provides a router that wraps bun-router and adds the ability
 * to use string paths like 'Actions/MyAction' or 'Controllers/MyController@method'
 */

import type { Server } from 'bun'
import type { ActionHandler, EnhancedRequest, Route, ServerOptions } from 'bun-router'
import process from 'node:process'
import { log } from '@stacksjs/logging'
import { path as p } from '@stacksjs/path'
import { UploadedFile } from '@stacksjs/storage'
import { Router } from 'bun-router'
import { runWithRequest } from './request-context'

type StringHandler = string
type StacksHandler = ActionHandler | StringHandler

interface StacksRouterConfig {
  verbose?: boolean
  apiPrefix?: string
}

interface GroupOptions {
  prefix?: string
  middleware?: ActionHandler[]
}

/**
 * Chainable route interface for middleware support
 */
interface ChainableRoute {
  middleware: (name: string) => ChainableRoute
}

/**
 * Cache for loaded middleware handlers
 */
const middlewareCache = new Map<string, any>()

/**
 * Load a middleware by name from app/Middleware or defaults
 */
async function loadMiddleware(name: string): Promise<any> {
  if (middlewareCache.has(name)) {
    return middlewareCache.get(name)
  }

  try {
    // Try loading from app/Middleware first
    const userPath = p.appPath(`Middleware/${name.charAt(0).toUpperCase() + name.slice(1)}.ts`)
    const middleware = await import(userPath)
    middlewareCache.set(name, middleware.default)
    return middleware.default
  }
  catch {
    try {
      // Fall back to defaults
      const defaultPath = p.storagePath(`framework/defaults/middleware/${name.charAt(0).toUpperCase() + name.slice(1)}.ts`)
      const middleware = await import(defaultPath)
      middlewareCache.set(name, middleware.default)
      return middleware.default
    }
    catch (err) {
      log.error(`[Router] Failed to load middleware '${name}':`, err)
      return null
    }
  }
}

/**
 * Registry for route middleware - maps route paths to middleware names
 */
const routeMiddlewareRegistry = new Map<string, string[]>()

/**
 * Parse middleware name and parameters
 * e.g., 'abilities:read,write' -> { name: 'abilities', params: 'read,write' }
 */
function parseMiddlewareName(middleware: string): { name: string, params?: string } {
  const colonIndex = middleware.indexOf(':')
  if (colonIndex === -1) {
    return { name: middleware }
  }
  return {
    name: middleware.substring(0, colonIndex),
    params: middleware.substring(colonIndex + 1),
  }
}

/**
 * Create a wrapped handler with middleware support
 */
function createMiddlewareHandler(routeKey: string, handler: StacksHandler): ActionHandler {
  // Create the base handler with skipParsing=true since we'll do it ourselves
  const wrappedBase = wrapHandler(handler, true)

  return async (req: EnhancedRequest) => {
    // Parse body and enhance request first
    await parseRequestBody(req)
    const enhancedReq = enhanceWithLaravelMethods(req)

    // Run the entire request handling within the request context
    // This allows Auth and other services to access the current request
    return runWithRequest(enhancedReq as any, async () => {
      const middlewareEntries = routeMiddlewareRegistry.get(routeKey) || []

      // Run middleware in order
      for (const middlewareEntry of middlewareEntries) {
        const { name: middlewareName, params } = parseMiddlewareName(middlewareEntry)

        // Store middleware params on request for middleware to access
        if (params) {
          ;(enhancedReq as any)._middlewareParams = (enhancedReq as any)._middlewareParams || {}
          ;(enhancedReq as any)._middlewareParams[middlewareName] = params
        }

        const middleware = await loadMiddleware(middlewareName)
        if (middleware && typeof middleware.handle === 'function') {
          try {
            await middleware.handle(enhancedReq)
          }
          catch (error) {
            // Middleware threw an error (e.g., 401 Unauthorized)
            if (error instanceof Error && 'statusCode' in error) {
              const httpError = error as Error & { statusCode: number }
              return new Response(
                JSON.stringify({ error: error.message }),
                {
                  status: httpError.statusCode,
                  headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                  },
                },
              )
            }
            throw error
          }
        }
      }

      // Call the actual handler with the enhanced request
      return wrappedBase(enhancedReq)
    })
  }
}

/**
 * Create a chainable route object (for .middleware() support)
 */
function createChainableRoute(routeKey: string): ChainableRoute {
  // Initialize middleware list for this route
  if (!routeMiddlewareRegistry.has(routeKey)) {
    routeMiddlewareRegistry.set(routeKey, [])
  }

  const chain: ChainableRoute = {
    middleware(name: string) {
      const middlewareList = routeMiddlewareRegistry.get(routeKey)
      if (middlewareList) {
        middlewareList.push(name)
      }
      return chain
    },
  }
  return chain
}

/**
 * Resolve a string handler to an actual handler function
 */
async function resolveStringHandler(handlerPath: string): Promise<ActionHandler> {
  let modulePath = handlerPath

  // Remove trailing .ts if present
  modulePath = modulePath.endsWith('.ts') ? modulePath.slice(0, -3) : modulePath

  // Handle controller-based routing (e.g., 'Controllers/MyController@method')
  if (modulePath.includes('Controller')) {
    const [controllerPath, methodName = 'index'] = modulePath.split('@')
    const fullPath = p.appPath(`${controllerPath}.ts`)


    try {
      const controller = await import(fullPath)
      // eslint-disable-next-line new-cap
      const instance = new controller.default()

      if (typeof instance[methodName] !== 'function') {
        throw new Error(`Method ${methodName} not found in controller ${controllerPath}`)
      }

      return async (req: EnhancedRequest) => {
        const result = await instance[methodName](req)
        return formatResult(result)
      }
    }
    catch (error) {
      log.error(`[Router] Failed to load controller '${fullPath}':`, error)
      throw error
    }
  }

  // Handle action-based routing (e.g., 'Actions/MyAction')
  let fullPath: string

  if (modulePath.includes('storage/framework/orm')) {
    fullPath = modulePath
  }
  else if (modulePath.includes('Actions')) {
    fullPath = p.projectPath(`app/${modulePath}.ts`)
  }
  else if (modulePath.includes('OrmAction')) {
    fullPath = p.storagePath(`framework/actions/src/${modulePath}.ts`)
  }
  else {
    fullPath = p.appPath(`${modulePath}.ts`)
  }


  try {
    const actionModule = await import(fullPath)
    const action = actionModule.default

    if (!action) {
      throw new Error(`Action '${handlerPath}' has no default export`)
    }

    if (typeof action.handle !== 'function') {
      log.error(`[Router] Action '${handlerPath}' structure:`, Object.keys(action))
      throw new Error(`Action '${handlerPath}' has no handle() method. Got: ${typeof action.handle}`)
    }

    return async (req: EnhancedRequest) => {
      try {
        // Validate action input if validations are defined
        if (action.validations) {
          const validationResult = await validateActionInput(req, action.validations)
          if (!validationResult.valid) {
            return new Response(JSON.stringify({
              success: false,
              message: 'Validation failed',
              errors: validationResult.errors,
            }), {
              status: 422,
              headers: { 'Content-Type': 'application/json' },
            })
          }
        }

        const result = await action.handle(req)
        return formatResult(result)
      }
      catch (handleError) {
        log.error(`[Router] Error in action.handle() for '${handlerPath}':`, handleError)
        throw handleError
      }
    }
  }
  catch (importError) {
    log.error(`[Router] Failed to import action '${fullPath}':`, importError)
    throw importError
  }
}

/**
 * Validation result interface
 */
interface ValidationResult {
  valid: boolean
  errors: Record<string, string[]>
}

/**
 * Action validations interface
 */
interface ActionValidations {
  [key: string]: {
    rule: { validate: (value: unknown) => { valid: boolean, errors?: Array<{ message: string }> } }
    message?: string | Record<string, string>
  }
}

/**
 * Validate action input against defined validations
 */
async function validateActionInput(req: EnhancedRequest, validations: ActionValidations): Promise<ValidationResult> {
  const errors: Record<string, string[]> = {}

  // Get input data from request (query params, body, etc.)
  const input = await getRequestInput(req)

  for (const [field, validation] of Object.entries(validations)) {
    const value = input[field]
    const result = validation.rule.validate(value)

    if (!result.valid) {
      const fieldErrors: string[] = []

      if (result.errors && result.errors.length > 0) {
        // Use custom message if provided, otherwise use validation error messages
        if (validation.message) {
          fieldErrors.push(typeof validation.message === 'string' ? validation.message : validation.message[field] || result.errors[0].message)
        }
        else {
          result.errors.forEach(err => fieldErrors.push(err.message))
        }
      }
      else {
        fieldErrors.push(validation.message ? (typeof validation.message === 'string' ? validation.message : `${field} is invalid`) : `${field} is invalid`)
      }

      errors[field] = fieldErrors
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  }
}

/**
 * Get all input data from request (body + query params)
 * Uses already-parsed body from parseRequestBody() when available
 */
async function getRequestInput(req: EnhancedRequest): Promise<Record<string, unknown>> {
  const input: Record<string, unknown> = {}

  // Get query parameters
  const url = new URL(req.url)
  url.searchParams.forEach((value, key) => {
    input[key] = value
  })

  // Get route params if available
  if ((req as any).params) {
    Object.assign(input, (req as any).params)
  }

  // Use already-parsed body (from parseRequestBody) if available
  if ((req as any).jsonBody && typeof (req as any).jsonBody === 'object') {
    Object.assign(input, (req as any).jsonBody)
  }
  else if ((req as any).formBody && typeof (req as any).formBody === 'object') {
    Object.assign(input, (req as any).formBody)
  }

  return input
}

/**
 * Format a result into a Response
 */
function formatResult(result: unknown): Response {
  if (result instanceof Response) {
    return result
  }

  if (typeof result === 'object' && result !== null) {
    return Response.json(result)
  }

  return new Response(String(result), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}

/**
 * Wrap a handler that might be a string path
 */
/**
 * Add Laravel-style helper methods to request if not already present
 */
function enhanceWithLaravelMethods(req: EnhancedRequest): EnhancedRequest {
  // If methods already exist, return as-is
  if (typeof (req as any).get === 'function') {
    return req
  }

  // Parse query string if not present
  let query = (req as any).query
  if (!query) {
    const url = new URL(req.url)
    query = {} as Record<string, string>
    url.searchParams.forEach((value, key) => {
      query[key] = value
    })
    ;(req as any).query = query
  }

  // Helper to get all input data
  const getAllInput = (): Record<string, any> => {
    const input: Record<string, any> = {}

    // Query parameters
    for (const [key, value] of Object.entries(query || {})) {
      input[key] = value
    }

    // JSON body
    if ((req as any).jsonBody && typeof (req as any).jsonBody === 'object') {
      for (const [key, value] of Object.entries((req as any).jsonBody)) {
        input[key] = value
      }
    }

    // Form body
    if ((req as any).formBody && typeof (req as any).formBody === 'object') {
      for (const [key, value] of Object.entries((req as any).formBody)) {
        input[key] = value
      }
    }

    // Route params
    if ((req as any).params && typeof (req as any).params === 'object') {
      for (const [key, value] of Object.entries((req as any).params)) {
        input[key] = value
      }
    }

    return input
  }

  // Add Laravel-style methods
  ;(req as any).get = <T = any>(key: string, defaultValue?: T): T => {
    const input = getAllInput()
    const value = input[key]
    return (value !== undefined ? value : defaultValue) as T
  }

  ;(req as any).input = <T = any>(key: string, defaultValue?: T): T => {
    const input = getAllInput()
    const value = input[key]
    return (value !== undefined ? value : defaultValue) as T
  }

  ;(req as any).all = (): Record<string, any> => getAllInput()

  ;(req as any).only = <T extends Record<string, unknown>>(keys: string[]): T => {
    const input = getAllInput()
    const result = {} as T
    for (const key of keys) {
      if (key in input) {
        (result as any)[key] = input[key]
      }
    }
    return result
  }

  ;(req as any).except = <T extends Record<string, unknown>>(keys: string[]): T => {
    const input = getAllInput()
    const result = { ...input } as T
    for (const key of keys) {
      delete (result as any)[key]
    }
    return result
  }

  ;(req as any).has = (key: string | string[]): boolean => {
    const input = getAllInput()
    if (Array.isArray(key)) {
      return key.every(k => k in input && input[k] !== undefined)
    }
    return key in input && input[key] !== undefined
  }

  ;(req as any).hasAny = (keys: string[]): boolean => {
    const input = getAllInput()
    return keys.some(k => k in input && input[k] !== undefined)
  }

  ;(req as any).filled = (key: string | string[]): boolean => {
    const input = getAllInput()
    const isFilled = (k: string): boolean => {
      const value = input[k]
      return value !== undefined && value !== null && value !== '' && !(Array.isArray(value) && value.length === 0)
    }
    if (Array.isArray(key)) {
      return key.every(isFilled)
    }
    return isFilled(key)
  }

  ;(req as any).missing = (key: string | string[]): boolean => {
    const input = getAllInput()
    if (Array.isArray(key)) {
      return key.every(k => !(k in input) || input[k] === undefined)
    }
    return !(key in input) || input[key] === undefined
  }

  ;(req as any).string = (key: string, defaultValue: string = ''): string => {
    const input = getAllInput()
    const value = input[key]
    return value !== undefined && value !== null ? String(value) : defaultValue
  }

  ;(req as any).integer = (key: string, defaultValue: number = 0): number => {
    const input = getAllInput()
    const value = input[key]
    const parsed = Number.parseInt(String(value), 10)
    return Number.isNaN(parsed) ? defaultValue : parsed
  }

  ;(req as any).float = (key: string, defaultValue: number = 0): number => {
    const input = getAllInput()
    const value = input[key]
    const parsed = Number.parseFloat(String(value))
    return Number.isNaN(parsed) ? defaultValue : parsed
  }

  ;(req as any).boolean = (key: string, defaultValue: boolean = false): boolean => {
    const input = getAllInput()
    const value = input[key]
    if (value === undefined || value === null) return defaultValue
    if (typeof value === 'boolean') return value
    if (value === 'true' || value === '1' || value === 1) return true
    if (value === 'false' || value === '0' || value === 0) return false
    return defaultValue
  }

  ;(req as any).array = <T = unknown>(key: string): T[] => {
    const input = getAllInput()
    const value = input[key]
    if (Array.isArray(value)) return value as T[]
    return value !== undefined && value !== null ? [value as T] : []
  }

  // File handling methods - returns UploadedFile with store/storeAs methods
  ;(req as any).file = (key: string): UploadedFile | null => {
    const files = (req as any).files || {}
    const file = files[key]
    if (!file) return null
    const rawFile = Array.isArray(file) ? file[0] : file
    return rawFile ? new UploadedFile(rawFile) : null
  }

  ;(req as any).getFiles = (key: string): UploadedFile[] => {
    const files = (req as any).files || {}
    const file = files[key]
    if (!file) return []
    const fileArray = Array.isArray(file) ? file : [file]
    return fileArray.map(f => new UploadedFile(f))
  }

  ;(req as any).hasFile = (key: string): boolean => {
    const files = (req as any).files || {}
    return key in files && files[key] !== undefined
  }

  ;(req as any).allFiles = (): Record<string, UploadedFile | UploadedFile[]> => {
    const files = (req as any).files || {}
    const result: Record<string, UploadedFile | UploadedFile[]> = {}
    for (const [key, value] of Object.entries(files)) {
      if (Array.isArray(value)) {
        result[key] = value.map(f => new UploadedFile(f as File))
      } else {
        result[key] = new UploadedFile(value as File)
      }
    }
    return result
  }

  // Auth method - returns the authenticated user set by middleware
  ;(req as any).user = async (): Promise<any> => {
    // Return user set by auth middleware (e.g., BearerToken middleware)
    return (req as any)._authenticatedUser
  }

  // Get the current access token instance
  ;(req as any).userToken = async (): Promise<any> => {
    return (req as any)._currentAccessToken
  }

  // Check if the current token has an ability
  ;(req as any).tokenCan = async (ability: string): Promise<boolean> => {
    const token = (req as any)._currentAccessToken
    if (!token)
      return false
    if (token.abilities?.includes('*'))
      return true
    return token.abilities?.includes(ability) ?? false
  }

  // Check if the current token does NOT have an ability
  ;(req as any).tokenCant = async (ability: string): Promise<boolean> => {
    return !(await (req as any).tokenCan(ability))
  }

  return req
}

function wrapHandler(handler: StacksHandler, skipParsing = false): ActionHandler {
  if (typeof handler === 'string') {
    const handlerPath = handler // capture for error messages
    return async (req: EnhancedRequest) => {
      try {
        // Skip parsing if already done (e.g., by createMiddlewareHandler)
        if (!skipParsing) {
          // Parse JSON body BEFORE enhancing with Laravel methods
          await parseRequestBody(req)

          // Enhance request with Laravel-style methods
          req = enhanceWithLaravelMethods(req)
        }

        const resolvedHandler = await resolveStringHandler(handlerPath)
        return resolvedHandler(req)
      }
      catch (error) {
        log.error(`[Router] Error handling request for '${handlerPath}':`, error)
        // Return error with CORS headers so browsers can see the error
        return new Response(
          JSON.stringify({
            error: 'Internal Server Error',
            message: error instanceof Error ? error.message : String(error),
            handler: handlerPath,
            stack: process.env.NODE_ENV !== 'production' && error instanceof Error ? error.stack : undefined,
          }),
          {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
              'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            },
          },
        )
      }
    }
  }
  return handler
}

/**
 * Parse request body and attach to request object
 */
async function parseRequestBody(req: EnhancedRequest): Promise<void> {
  const contentType = req.headers.get('content-type') || ''

  try {
    if (contentType.includes('application/json')) {
      const body = await req.clone().json()
      ;(req as any).jsonBody = body
    }
    else if (contentType.includes('application/x-www-form-urlencoded')) {
      const text = await req.clone().text()
      const params = new URLSearchParams(text)
      const formBody: Record<string, string> = {}
      params.forEach((value, key) => {
        formBody[key] = value
      })
      ;(req as any).formBody = formBody
    }
    else if (contentType.includes('multipart/form-data')) {
      const formData = await req.clone().formData()
      const formBody: Record<string, unknown> = {}
      const files: Record<string, File | File[]> = {}

      formData.forEach((value, key) => {
        if (value instanceof File) {
          // Handle file uploads
          if (files[key]) {
            // Multiple files with same key
            if (Array.isArray(files[key])) {
              (files[key] as File[]).push(value)
            }
            else {
              files[key] = [files[key] as File, value]
            }
          }
          else {
            files[key] = value
          }
        }
        else {
          // Regular form field
          formBody[key] = value
        }
      })

      ;(req as any).formBody = formBody
      ;(req as any).files = files
    }
  }
  catch (e) {
    // Body parsing failed - log it for debugging
    console.error('[stacks-router] Body parsing failed:', e)
  }
}

/**
 * Create a Stacks-enhanced router
 */
export function createStacksRouter(config: StacksRouterConfig = {}): StacksRouterInstance {
  const bunRouter = new Router({
    verbose: config.verbose ?? process.env.APP_ENV !== 'production',
  })

  let currentPrefix = ''

  const stacksRouter: StacksRouterInstance = {
    // Access underlying bun-router
    bunRouter,

    // Get all routes
    get routes(): Route[] {
      return bunRouter.routes
    },

    // HTTP methods with string handler support
    get(path: string, handler: StacksHandler) {
      const fullPath = currentPrefix + path
      const routeKey = `GET:${fullPath}`
      bunRouter.get(fullPath, createMiddlewareHandler(routeKey, handler))
      return createChainableRoute(routeKey)
    },

    post(path: string, handler: StacksHandler) {
      const fullPath = currentPrefix + path
      const routeKey = `POST:${fullPath}`
      bunRouter.post(fullPath, createMiddlewareHandler(routeKey, handler))
      return createChainableRoute(routeKey)
    },

    put(path: string, handler: StacksHandler) {
      const fullPath = currentPrefix + path
      const routeKey = `PUT:${fullPath}`
      bunRouter.put(fullPath, createMiddlewareHandler(routeKey, handler))
      return createChainableRoute(routeKey)
    },

    patch(path: string, handler: StacksHandler) {
      const fullPath = currentPrefix + path
      const routeKey = `PATCH:${fullPath}`
      bunRouter.patch(fullPath, createMiddlewareHandler(routeKey, handler))
      return createChainableRoute(routeKey)
    },

    delete(path: string, handler: StacksHandler) {
      const fullPath = currentPrefix + path
      const routeKey = `DELETE:${fullPath}`
      bunRouter.delete(fullPath, createMiddlewareHandler(routeKey, handler))
      return createChainableRoute(routeKey)
    },

    options(path: string, handler: StacksHandler) {
      const fullPath = currentPrefix + path
      const routeKey = `OPTIONS:${fullPath}`
      bunRouter.options(fullPath, createMiddlewareHandler(routeKey, handler))
      return createChainableRoute(routeKey)
    },

    // Route grouping - always synchronous for prefix management
    // The callback may be async, but route registration is synchronous
    group(options: GroupOptions, callback: () => void | Promise<void>): StacksRouterInstance {
      const previousPrefix = currentPrefix

      if (options.prefix) {
        currentPrefix = previousPrefix + options.prefix
      }

      // Call the callback - route registrations happen synchronously
      // even if the callback is async (routes register before any await)
      callback()

      // Always restore prefix immediately after callback returns
      // This ensures the next group() call sees the correct prefix
      currentPrefix = previousPrefix
      return stacksRouter
    },

    // Health check route
    health() {
      bunRouter.get('/health', () => Response.json({ status: 'healthy', timestamp: Date.now() }))
      return stacksRouter
    },

    // Use middleware
    use(middleware: ActionHandler) {
      // bunRouter.use() is async, so we need to call it properly
      // For synchronous chaining, we push directly to globalMiddleware
      bunRouter.globalMiddleware.push(middleware)
      return stacksRouter
    },

    // Serve the router
    async serve(options: ServerOptions = {}): Promise<Server> {
      return bunRouter.serve(options)
    },

    // Handle a request directly
    async handleRequest(req: Request): Promise<Response> {
      return bunRouter.handleRequest(req)
    },

    // Import routes from route files
    async importRoutes(): Promise<void> {
      try {
        const userRoutesPath = p.routesPath('api.ts')
        const ormRoutesPath = p.frameworkPath('core/orm/routes.ts')

        await import(userRoutesPath)
        await import(ormRoutesPath)
      }
      catch (error) {
        log.error('Failed to import routes:', error)
      }
    },
  }

  return stacksRouter
}

export interface StacksRouterInstance {
  bunRouter: Router
  routes: Route[]
  get: (path: string, handler: StacksHandler) => ChainableRoute
  post: (path: string, handler: StacksHandler) => ChainableRoute
  put: (path: string, handler: StacksHandler) => ChainableRoute
  patch: (path: string, handler: StacksHandler) => ChainableRoute
  delete: (path: string, handler: StacksHandler) => ChainableRoute
  options: (path: string, handler: StacksHandler) => ChainableRoute
  group: (options: GroupOptions, callback: () => void | Promise<void>) => StacksRouterInstance
  health: () => StacksRouterInstance
  use: (middleware: ActionHandler) => StacksRouterInstance
  serve: (options?: ServerOptions) => Promise<Server>
  handleRequest: (req: Request) => Promise<Response>
  importRoutes: () => Promise<void>
}

// Create and export a default router instance
export const route = createStacksRouter()

// Export serve function that uses the default router
export async function serve(options: ServerOptions = {}): Promise<Server> {
  return route.serve(options)
}
