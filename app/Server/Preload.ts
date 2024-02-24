/**
 * This file is loaded before the main (Bun) process is started.
 * You may use this file to preload/define plugins that will
 * automatically be injected into the Bun process.
 */

await import('bun-plugin-env') // allows for importing .env files
await import('bun-plugin-yml') // allows for importing .yaml files

// you may define a custom plugin:

// import { type BunPlugin, plugin } from 'bun'

// const myPlugin: BunPlugin = {
//   name: 'Custom Loader',
//   setup(build) {
//     // implementation
//   },
// }

// plugin(myPlugin)
