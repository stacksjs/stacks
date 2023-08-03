import { type ViteDevServer as DevServer, type Plugin } from 'vite'
import { kolorist as c } from '@stacksjs/cli'
import { version } from '../../package.json'
import app from '~/config/app'

// https://github.com/hannoeru/vite-plugin-pages
export function stacks(): Plugin {
  return {
    name: 'stacks',

    // BuildStart hook before the build starts
    // buildStart(options) {
    buildStart() {
      // console.log('BuildStart hook with options:', options)
    },

    // Load hook for loading individual files
    // async load(id) {
    load() {
      return null // Return null to let Vite handle the file loading
    },

    // async resolveId(source, importer) {
    resolveId() {
      return null // Return null to let Vite handle the module resolution
    },

    // Transform hook for transforming individual files
    // async transform(code, id) {
    transform(code) {
      return code // Return the unmodified code
    },

    configureServer(server: DevServer) {
      // const base = server.config.base || '/'
      // const _print = server.printUrls
      server.printUrls = () => {
        // const url = server.resolvedUrls?.local[0]
        //
        // if (url) {
        //   try {
        //     const u = new URL(url)
        //     // eslint-disable-next-line no-console
        //     console.log(`${u.protocol}//${u.host}`)
        //     // const host = `${u.protocol}//${u.host}`
        //   }
        //   catch (error) {
        //     log.warn('Parse resolved url failed:', error)
        //   }
        // }

        const appUrl = app.url
        const frontendUrl = `https://${appUrl}`
        const backendUrl = `https://api.${appUrl}`
        const dashboardUrl = `https://admin.${appUrl}`
        const libraryUrl = `https://libs.${appUrl}`
        const docsUrl = `https://docs.${appUrl}`
        const inspectUrl = `https://${appUrl}/__inspect/`

        // const pkg = await storage.readPackageJson(frameworkPath('./package.json')) // TODO: fix this async call placing `press h to show help` on top
        const stacksVersion = `alpha-${version}`

        // eslint-disable-next-line no-console
        console.log(`  ${c.blue(c.bold('STACKS'))} ${c.blue(stacksVersion)}`)
        // eslint-disable-next-line no-console
        console.log(`  ${c.green('➜')}  ${c.bold('Frontend')}: ${c.green(frontendUrl)}`)
        // eslint-disable-next-line no-console
        console.log(`  ${c.green('➜')}  ${c.bold('Backend')}: ${c.green(backendUrl)}`)
        // eslint-disable-next-line no-console
        console.log(`  ${c.green('➜')}  ${c.bold('Dashboard')}: ${c.green(dashboardUrl)}`)
        // eslint-disable-next-line no-console
        console.log(`  ${c.green('➜')}  ${c.bold('Library')}: ${c.green(libraryUrl)}`)
        // eslint-disable-next-line no-console
        console.log(`  ${c.green('➜')}  ${c.bold('Docs')}: ${c.green(docsUrl)}`)
        // eslint-disable-next-line no-console
        console.log(`  ${c.green('➜')}  ${c.dim('Inspect')}: ${c.green(inspectUrl)}`)
      }
    },
  }
}
