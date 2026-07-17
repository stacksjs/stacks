/**
 * Bun plugin entry point for automatic .env loading
 * This file can be imported in bunfig.toml preload or used programmatically
 */

import { autoLoadEnv } from './src/plugin'

// Auto-load .env files when this module is imported
const result = autoLoadEnv({ quiet: false })

if (result.errors.length > 0) {
  console.error('[env-plugin] Errors:', result.errors)
}

// Export for programmatic usage
export { autoLoadEnv, envPlugin, loadEnv } from './src/plugin'
export * from './src/crypto'
export * from './src/parser'
export * from './src/cli'
