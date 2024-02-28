/**
 * Main Preloader
 *
 * This file is loaded before the main (Bun) process is started.
 * You may use this file to preload/define plugins that will
 * automatically be injected into the Bun process.
 */

// allows for importing .env files
await import('bun-plugin-env')

// allows for importing .yaml files
await import('bun-plugin-yml')
