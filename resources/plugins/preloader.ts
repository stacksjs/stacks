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
