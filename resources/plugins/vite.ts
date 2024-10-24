import type { VitePlugin } from '@stacksjs/plugins'

/**
 * In case you need flexibility, Stacks plugins can provide you with a
 * granular configugration. For example, watchers, transformers, and
 * hooks are available to you to customize your build process.
 */
export function plugin(): VitePlugin {
  return {
    name: 'stacks-integration',

    // BuildStart hook before the build starts
    // buildStart(options) {
    //  console.log('BuildStart hook with options:', options)
    // },

    // Load hook for loading individual files
    // async load(id) {
    //   return null // Return null to let Vite handle the file loading
    // },

    // async resolveId(source, importer) {
    // resolveId() {
    //   return null // Return null to let Vite handle the module resolution
    // },

    // Transform hook for transforming individual files
    // async transform(code, id) {
    //   return code // Return the unmodified code
    // },
  }
}
