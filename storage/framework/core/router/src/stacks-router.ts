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
import { Router } from 'bun-router'

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
 * Create a chainable route object (for .middleware() support)
 * Note: Middleware is not yet implemented, this just prevents errors
 */
function createChainableRoute(): ChainableRoute {
  const chain: ChainableRoute = {
    middleware(_name: string) {
      // TODO: Implement middleware support
      log.debug(`Middleware '${_name}' registered (not yet implemented)`)
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

  const actionModule = await import(fullPath)
  const action = actionModule.default

  return async (req: EnhancedRequest) => {
    const result = await action.handle(req)
    return formatResult(result)
  }
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
function wrapHandler(handler: StacksHandler): ActionHandler {
  if (typeof handler === 'string') {
    const handlerPath = handler // capture for error messages
    return async (req: EnhancedRequest) => {
      try {
        const resolvedHandler = await resolveStringHandler(handlerPath)
        return resolvedHandler(req)
      }
      catch (error) {
        log.error(`Error handling request for '${handlerPath}':`, error)
        return Response.json(
          { error: 'Internal Server Error', message: error instanceof Error ? error.message : String(error) },
          { status: 500 },
        )
      }
    }
  }
  return handler
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
      bunRouter.get(fullPath, wrapHandler(handler))
      return createChainableRoute()
    },

    post(path: string, handler: StacksHandler) {
      const fullPath = currentPrefix + path
      bunRouter.post(fullPath, wrapHandler(handler))
      return createChainableRoute()
    },

    put(path: string, handler: StacksHandler) {
      const fullPath = currentPrefix + path
      bunRouter.put(fullPath, wrapHandler(handler))
      return createChainableRoute()
    },

    patch(path: string, handler: StacksHandler) {
      const fullPath = currentPrefix + path
      bunRouter.patch(fullPath, wrapHandler(handler))
      return createChainableRoute()
    },

    delete(path: string, handler: StacksHandler) {
      const fullPath = currentPrefix + path
      bunRouter.delete(fullPath, wrapHandler(handler))
      return createChainableRoute()
    },

    options(path: string, handler: StacksHandler) {
      const fullPath = currentPrefix + path
      bunRouter.options(fullPath, wrapHandler(handler))
      return createChainableRoute()
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
      bunRouter.use(middleware)
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

        log.debug(`Importing user routes from: ${userRoutesPath}`)
        log.debug(`Importing ORM routes from: ${ormRoutesPath}`)

        await import(userRoutesPath)
        await import(ormRoutesPath)

        log.debug(`Routes imported successfully. Total routes: ${bunRouter.routes.length}`)
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
