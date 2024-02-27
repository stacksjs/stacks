/**
 * Preloader
 *
 * This file is loaded before the main (Bun) process is started.
 * You may use this file to preload/define plugins that will
 * automatically be injected into the Bun process.
 *
 * @example Custom YAML loader plugin
 * import { type BunPlugin, plugin } from 'bun'
 *
 * const myPlugin: BunPlugin = {
 *   name: 'custom-yaml-loader',
 *   async setup(build) {
 *     const { load } = await import('js-yaml')
 *
 *     // when a .yaml file is imported...
 *     build.onLoad({ filter: /\.(yaml|yml)$/ }, async (args) => {
 *       // read and parse the file
 *       const text = await Bun.file(args.path).text()
 *       const exports = load(text) as Record<string, any>
 *
 *       // and return it as a module
 *       return {
 *         exports,
 *         loader: 'object', // special loader for JS objects
 *       }
 *     })
 *   },
 * }
 *
 * plugin(myPlugin)
 */

// allows for importing .env files
await import('bun-plugin-env')

// allows for importing .yaml files
await import('bun-plugin-yml')

// you may also define any other custom plugins here
