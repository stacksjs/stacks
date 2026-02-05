// Auto-initialize API on import (runs as side effect)
import './auto-init'

export * from './composables'
export * from './utils'
export * from './model-loader'

// Re-export browser query builder from bun-query-builder
export {
  browserQuery,
  BrowserQueryBuilder,
  BrowserQueryError,
  browserAuth,
  configureBrowser,
  getBrowserConfig,
  createBrowserDb,
  createBrowserModel,
  isBrowser,
} from 'bun-query-builder'
export type {
  BrowserConfig,
  BrowserModelDefinition,
  BrowserTypedAttribute,
  BrowserModelInstance,
  BrowserModelQueryBuilder,
} from 'bun-query-builder'
