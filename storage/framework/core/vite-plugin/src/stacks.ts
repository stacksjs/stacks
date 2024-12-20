/* eslint no-console: 0 */
import type { Plugin } from 'vite'
import { parseOptions } from '@stacksjs/cli'

interface StacksPluginOptions {
  frontend?: boolean
  backend?: boolean
  admin?: boolean
  desktop?: boolean
  library?: boolean
  email?: boolean
  docs?: boolean
  config?: string // the vite config used
  withLocalhost?: boolean
}

export function stacks(options?: StacksPluginOptions): Plugin {
  if (!options)
    options = parseOptions() as StacksPluginOptions

  return {
    name: 'stacks',

    // BuildStart hook before the build starts
    // buildStart(options) {
    // buildStart() {
    //   // console.log('BuildStart hook with options:', options)
    // },

    // Load hook for loading individual files
    // async load(id) {
    // load() {
    //   return null // Return null to let Vite handle the file loading
    // },

    // async resolveId(source, importer) {
    // resolveId() {
    //   return null // Return null to let Vite handle the module resolution
    // },

    // Transform hook for transforming individual files
    // async transform(code, id) {
    // transform(code: any) {
    //   return code // Return the unmodified code
    // },

    // configureServer(server: DevServer) {

    // },
  }
}
