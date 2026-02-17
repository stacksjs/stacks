/**
 * Main Preloader
 *
 * This file is loaded before the main (Bun) process is started.
 * You may use this file to preload/define plugins that will
 * automatically be injected into the Bun process.
 */

// Skip preloader for fast commands to maximize startup speed
// These commands don't need env loading
const args = process.argv.slice(2)
const fastCommands = ['dev', 'build', 'test', 'lint', '--version', '-v', 'version', '--help', '-h', 'help']
const skipPreloader = args.length === 0 || fastCommands.includes(args[0])

if (!skipPreloader) {
  // Detect production/deployment commands and set environment accordingly BEFORE loading env files
  // This ensures the correct .env.{env} file is loaded with proper encryption/decryption
  const productionCommands = ['cloud:remove', 'cloud:rm', 'cloud:destroy', 'cloud:cleanup', 'cloud:clean-up', 'undeploy']
  const isProductionCommand = productionCommands.includes(args[0])

  // Handle deploy command which can have an optional env argument: `deploy [env]`
  const isDeployCommand = args[0] === 'deploy'
  if (isDeployCommand) {
    // Check if second arg is an environment (not a flag starting with -)
    const deployEnv = args[1] && !args[1].startsWith('-') ? args[1] : 'production'
    process.env.APP_ENV = deployEnv
    process.env.NODE_ENV = deployEnv
  }
  else if (isProductionCommand) {
    process.env.APP_ENV = 'production'
    process.env.NODE_ENV = 'production'
  }

  // Load .env files with encryption support using our native Bun plugin
  const { autoLoadEnv } = await import('@stacksjs/env')

  // Auto-load .env files based on environment
  // Set quiet: true to prevent duplicate logging across multiple processes
  autoLoadEnv({ quiet: true })
}

// stx template engine plugin
// enables .stx file processing
// NOTE: Commented out until bun-plugin-stx is properly installed
// Uncomment after running: bun add bun-plugin-stx
// eslint-disable-next-line antfu/no-top-level-await
// await import('bun-plugin-stx')

// Auto-import ALL Stacks framework modules into globalThis
// This allows using Action, response, Activity, etc. without ANY imports
async function loadAutoImports() {
  const { Glob } = await import('bun')
  const { path } = await import('@stacksjs/path')

  // CRITICAL: Never overwrite these built-in globals
  const protectedGlobals = new Set([
    'process', 'globalThis', 'global', 'window', 'self',
    'console', 'require', 'module', 'exports', '__dirname', '__filename',
    'Buffer', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
    'setImmediate', 'clearImmediate', 'queueMicrotask',
    'fetch', 'Request', 'Response', 'Headers', 'URL', 'URLSearchParams',
    'TextEncoder', 'TextDecoder', 'Blob', 'File', 'FormData',
    'crypto', 'performance', 'navigator', 'location',
    'Promise', 'Symbol', 'Proxy', 'Reflect', 'WeakMap', 'WeakSet', 'Map', 'Set',
    'Array', 'Object', 'String', 'Number', 'Boolean', 'Date', 'RegExp', 'Error',
    'JSON', 'Math', 'Intl', 'eval', 'isNaN', 'isFinite', 'parseInt', 'parseFloat',
    'encodeURI', 'encodeURIComponent', 'decodeURI', 'decodeURIComponent',
    'Bun', 'Deno', 'Node',
  ])

  // 1. Load Stacks framework packages into globalThis
  const stacksPackages = [
    '@stacksjs/actions',
    '@stacksjs/router',
    '@stacksjs/orm',
    '@stacksjs/validation',
    '@stacksjs/strings',
    '@stacksjs/arrays',
    '@stacksjs/objects',
    '@stacksjs/collections',
    '@stacksjs/path',
    '@stacksjs/storage',
    '@stacksjs/env',
    '@stacksjs/config',
    '@stacksjs/logging',
    '@stacksjs/cache',
    '@stacksjs/queue',
    '@stacksjs/events',
    '@stacksjs/notifications',
    '@stacksjs/email',
    '@stacksjs/security',
    '@stacksjs/auth',
    '@stacksjs/database',
    '@stacksjs/error-handling',
  ]

  for (const pkg of stacksPackages) {
    try {
      const module = await import(pkg)
      for (const [name, value] of Object.entries(module)) {
        // Skip default exports and protected globals
        if (name === 'default' || protectedGlobals.has(name)) continue
        if (typeof value !== 'undefined') {
          (globalThis as any)[name] = value
        }
      }
    } catch {
      // Package might not exist or not be built yet
    }
  }

  // 2. Load all functions from resources/functions
  const functionsPath = path.resourcesPath('functions')
  const glob = new Glob('**/*.ts')

  for await (const file of glob.scan({
    cwd: functionsPath,
    absolute: true,
    onlyFiles: true,
  })) {
    if (file.endsWith('.d.ts')) continue

    try {
      const module = await import(file)
      for (const [name, value] of Object.entries(module)) {
        // Skip default exports and protected globals
        if (name === 'default' || protectedGlobals.has(name)) continue
        if (typeof value !== 'undefined') {
          (globalThis as any)[name] = value
        }
      }
    } catch {
      // Some files may have client-side dependencies, skip them
    }
  }
}

// Load auto-imports for server/API contexts (serve, any server process)
// Skip for fast commands (dev, build, test, etc.) and CLI info commands
const skipAutoImports = skipPreloader || ['--version', '-v', 'version', '--help', '-h', 'help'].includes(args[0])
if (!skipAutoImports) {
  await loadAutoImports()
}
