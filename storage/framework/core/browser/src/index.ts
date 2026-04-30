// Auto-initialize API on import (runs as side effect)
import './auto-init'

export * from './composables'
export * from './utils'
export * from './model-loader'

// Re-export browser query builder from bun-query-builder.
//
// Pull from the dedicated `/browser` subpath instead of the main entry —
// the main entry pulls in `bun:sqlite`, `child_process`, `stream/promises`,
// etc. through server-side code branches, which the browser bundler can't
// elide. The package's own `./browser` export is purpose-built for this:
// only browser-safe code, no Node/Bun builtins.
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
} from 'bun-query-builder/browser'
export type {
  BrowserConfig,
  BrowserModelDefinition,
  BrowserTypedAttribute,
  BrowserModelInstance,
  BrowserModelQueryBuilder,
} from 'bun-query-builder/browser'
