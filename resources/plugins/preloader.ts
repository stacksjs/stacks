/**
 * Main Preloader
 *
 * This file is loaded before the main (Bun) process is started.
 * You may use this file to preload/define plugins that will
 * automatically be injected into the Bun process.
 */

// ensures .env file can handle encrypted variables
// and allows for importing .env* files
// @ts-expect-error - dtsx does not type this properly yet
// eslint-disable-next-line antfu/no-top-level-await
await import('bun-plugin-dotenvx')

// allows for importing .yaml files
// eslint-disable-next-line antfu/no-top-level-await
await import('bun-plugin-yml')
