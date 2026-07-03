/**
 * Bun plugin entry point for automatic .env loading
 * This file can be imported in bunfig.toml preload or used programmatically
 */

import { autoLoadEnv } from './src/plugin'

// Auto-load .env files when this module is imported
//
// keysFile MUST be passed here: autoLoadEnv only resolves a decryption
// private key from a keys FILE when explicitly told which one to read —
// without it, an encrypted .env file (DOTENV_PUBLIC_KEY_* + `encrypted:...`
// values) loads with every encrypted value left as raw ciphertext in
// process.env, silently breaking anything that reads process.env.SOME_SECRET
// directly, with no error — it just looks like a bogus/expired credential.
const result = autoLoadEnv({ quiet: false, keysFile: '.env.keys' })

if (result.errors.length > 0) {
  console.error('[env-plugin] Errors:', result.errors)
}

// Export for programmatic usage
export { autoLoadEnv, envPlugin, loadEnv } from './src/plugin'
export * from './src/crypto'
export * from './src/parser'
export * from './src/cli'
