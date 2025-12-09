/**
 * @stacksjs/router - Stacks Router
 *
 * A comprehensive router built on top of bun-router with Stacks-specific
 * features like Action/Controller resolution, ORM integration, and more.
 *
 * Re-exports all bun-router functionality plus Stacks adapters.
 */

// Re-export everything from bun-router
export * from 'bun-router'

// Export Stacks-specific modules
export * from './middleware'
export * from './request'
export * from './response'
export * from './router'
export * from './server'
export * from './static'
export * from './utils'
export * from './uploaded-file'

// Re-export commonly used bun-router types explicitly for convenience
export type {
  EnhancedRequest,
  Route,
  RouterConfig,
  MiddlewareHandler,
  ActionHandler,
  NextFunction,
} from 'bun-router'
