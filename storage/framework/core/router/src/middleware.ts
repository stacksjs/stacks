import type { MiddlewareOptions } from '@stacksjs/types'
import type { EnhancedRequest, MiddlewareHandler, NextFunction } from 'bun-router'
import type { Request } from './request'
import { userMiddlewarePath } from '@stacksjs/path'
import { fs } from '@stacksjs/storage'
import { log } from '@stacksjs/logging'

/**
 * Stacks Middleware class - wrapper for bun-router compatible middleware
 *
 * This provides backwards compatibility with the existing Stacks middleware
 * system while integrating with bun-router's middleware pipeline.
 */
export class Middleware implements MiddlewareOptions {
  /** Middleware name for registration */
  name: string

  /** Execution priority (lower = earlier) */
  priority: number

  /** Handler function */
  handle: (request: Request) => Promise<void> | void

  constructor(data: MiddlewareOptions) {
    this.name = data.name
    this.priority = data.priority
    this.handle = data.handle
  }

  /**
   * Convert to bun-router compatible middleware handler
   */
  toBunMiddleware(): MiddlewareHandler {
    return async (req: EnhancedRequest, next: NextFunction): Promise<Response | null> => {
      try {
        // Import Request class dynamically to avoid circular dependency
        const { Request: StacksRequest } = await import('./request')
        const stacksRequest = StacksRequest.fromEnhancedRequest(req)

        // Execute the Stacks middleware
        await this.handle(stacksRequest as unknown as Request)

        // Continue to next middleware
        return next()
      }
      catch (error: any) {
        // If middleware throws, return error response
        if (error.status) {
          return Response.json({ error: error.message }, { status: error.status })
        }
        throw error
      }
    }
  }
}

/**
 * Create a bun-router compatible middleware from a function
 *
 * @example
 * ```ts
 * const authMiddleware = createMiddleware(async (req, next) => {
 *   const token = req.headers.get('authorization')
 *   if (!token) {
 *     return Response.json({ error: 'Unauthorized' }, { status: 401 })
 *   }
 *   return next()
 * })
 * ```
 */
export function createMiddleware(
  handler: MiddlewareHandler,
): MiddlewareHandler {
  return handler
}

/**
 * Create a middleware that only runs for specific paths
 *
 * @example
 * ```ts
 * const apiAuthMiddleware = createPathMiddleware('/api', authMiddleware)
 * ```
 */
export function createPathMiddleware(
  pathPrefix: string,
  handler: MiddlewareHandler,
): MiddlewareHandler {
  return async (req: EnhancedRequest, next: NextFunction): Promise<Response | null> => {
    const url = new URL(req.url)
    if (url.pathname.startsWith(pathPrefix)) {
      return handler(req, next)
    }
    return next()
  }
}

/**
 * Create a middleware that only runs for specific HTTP methods
 *
 * @example
 * ```ts
 * const postOnlyMiddleware = createMethodMiddleware(['POST', 'PUT'], validationMiddleware)
 * ```
 */
export function createMethodMiddleware(
  methods: string[],
  handler: MiddlewareHandler,
): MiddlewareHandler {
  const upperMethods = methods.map(m => m.toUpperCase())
  return async (req: EnhancedRequest, next: NextFunction): Promise<Response | null> => {
    if (upperMethods.includes(req.method.toUpperCase())) {
      return handler(req, next)
    }
    return next()
  }
}

/**
 * Compose multiple middleware into a single handler
 *
 * @example
 * ```ts
 * const combined = composeMiddleware([
 *   corsMiddleware,
 *   authMiddleware,
 *   rateLimitMiddleware,
 * ])
 * ```
 */
export function composeMiddleware(
  middlewares: MiddlewareHandler[],
): MiddlewareHandler {
  return async (req: EnhancedRequest, next: NextFunction): Promise<Response | null> => {
    let index = -1

    const dispatch = async (i: number): Promise<Response | null> => {
      if (i <= index) {
        throw new Error('next() called multiple times')
      }
      index = i

      const middleware = middlewares[i]

      if (!middleware) {
        return next()
      }

      return middleware(req, () => dispatch(i + 1))
    }

    return dispatch(0)
  }
}

/**
 * Import all middleware files from the user's middleware directory
 */
export async function importMiddlewares(directory?: string): Promise<Middleware[]> {
  const middlewareDir = directory || userMiddlewarePath()
  const middlewares: Middleware[] = []

  try {
    if (!fs.existsSync(middlewareDir)) {
      log.debug(`Middleware directory not found: ${middlewareDir}`)
      return middlewares
    }

    const files = fs.readdirSync(middlewareDir)

    for (const file of files) {
      if (!file.endsWith('.ts') && !file.endsWith('.js')) continue

      try {
        const filePath = `${middlewareDir}/${file}`
        const imported = await import(filePath)

        if (imported.default) {
          if (imported.default instanceof Middleware) {
            middlewares.push(imported.default)
          }
          else if (typeof imported.default === 'object' && imported.default.handle) {
            middlewares.push(new Middleware(imported.default))
          }
        }
      }
      catch (error) {
        log.error(`Failed to import middleware from ${file}:`, error)
      }
    }

    // Sort by priority
    middlewares.sort((a, b) => a.priority - b.priority)

    return middlewares
  }
  catch (error) {
    log.error('Failed to import middlewares:', error)
    return middlewares
  }
}

/**
 * Get all middleware from the user's middleware directory
 *
 * @deprecated Use importMiddlewares() instead
 */
export async function middlewares(): Promise<string[]> {
  const middlewareDir = userMiddlewarePath()

  try {
    if (!fs.existsSync(middlewareDir)) {
      return []
    }

    const files = fs.readdirSync(middlewareDir)
    return files.filter(f => f.endsWith('.ts') || f.endsWith('.js'))
  }
  catch {
    return []
  }
}

/**
 * Convert a Stacks middleware to bun-router format
 */
export function convertStacksMiddleware(
  stacksMiddleware: MiddlewareOptions,
): MiddlewareHandler {
  return new Middleware(stacksMiddleware).toBunMiddleware()
}

// ============================================================================
// COMMON MIDDLEWARE FACTORIES
// ============================================================================

/**
 * Create a timing middleware that logs request duration
 */
export function createTimingMiddleware(name: string = 'request'): MiddlewareHandler {
  return async (req: EnhancedRequest, next: NextFunction): Promise<Response | null> => {
    const start = performance.now()
    const response = await next()
    const duration = performance.now() - start

    log.debug(`[${name}] ${req.method} ${new URL(req.url).pathname} - ${duration.toFixed(2)}ms`)

    return response
  }
}

/**
 * Create a request logging middleware
 */
export function createLoggingMiddleware(): MiddlewareHandler {
  return async (req: EnhancedRequest, next: NextFunction): Promise<Response | null> => {
    const url = new URL(req.url)
    const start = Date.now()

    log.info(`--> ${req.method} ${url.pathname}`)

    const response = await next()

    const duration = Date.now() - start
    const status = response?.status || 200

    log.info(`<-- ${req.method} ${url.pathname} ${status} ${duration}ms`)

    return response
  }
}

/**
 * Create a maintenance mode middleware
 */
export function createMaintenanceMiddleware(
  options: {
    enabled?: boolean | (() => boolean | Promise<boolean>)
    allowedIPs?: string[]
    message?: string
  } = {},
): MiddlewareHandler {
  const { enabled = false, allowedIPs = [], message = 'Service temporarily unavailable' } = options

  return async (req: EnhancedRequest, next: NextFunction): Promise<Response | null> => {
    const isEnabled = typeof enabled === 'function' ? await enabled() : enabled

    if (!isEnabled) {
      return next()
    }

    // Check if IP is allowed
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('x-real-ip')
      || ''

    if (allowedIPs.includes(clientIP)) {
      return next()
    }

    return Response.json(
      { error: message },
      { status: 503, headers: { 'Retry-After': '3600' } },
    )
  }
}

// Re-export types
export type { MiddlewareHandler, NextFunction, EnhancedRequest }
