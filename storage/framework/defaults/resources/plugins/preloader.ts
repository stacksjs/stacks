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
