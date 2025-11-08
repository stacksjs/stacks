/**
 * Main Preloader
 *
 * This file is loaded before the main (Bun) process is started.
 * You may use this file to preload/define plugins that will
 * automatically be injected into the Bun process.
 */

// Load .env files with encryption support using our native Bun plugin
import { autoLoadEnv } from '@stacksjs/env'

// Auto-load .env files based on environment
autoLoadEnv({ quiet: false })

// stx template engine plugin
// enables .stx file processing
// NOTE: Commented out until bun-plugin-stx is properly installed
// Uncomment after running: bun add bun-plugin-stx
// eslint-disable-next-line antfu/no-top-level-await
// await import('bun-plugin-stx')
