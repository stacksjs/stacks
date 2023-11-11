import type { ViteDevServer as DevServer, Plugin } from 'vite'
import { kolorist as c, parseOptions } from '@stacksjs/cli'
import { localUrl } from '@stacksjs/config'
import { version } from '../../package.json'

type StacksPluginOptions = {
  frontend?: boolean
  backend?: boolean
  admin?: boolean
  desktop?: boolean
  library?: boolean
  email?: boolean
  docs?: boolean
  config?: string // the vite config used
}

// https://github.com/hannoeru/vite-plugin-pages
export function stacks(options?: StacksPluginOptions): Plugin {
  if (!options)
    options = parseOptions()

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
      server.printUrls = async () => {
        const urls = {
          frontend: await localUrl({ type: 'frontend', https: true }),
          backend: await localUrl({ type: 'backend', https: true }),
          admin: await localUrl({ type: 'admin', https: true }),
          library: await localUrl({ type: 'library', https: true }),
          email: await localUrl({ type: 'email', https: true }),
          docs: await localUrl({ type: 'docs', https: true }),
          desktop: await localUrl({ type: 'desktop', https: true }),
          inspect: await localUrl({ type: 'inspect', https: true }),
        }

        const stacksVersion = `alpha-${version}`

        console.log(`  ${c.blue(c.bold('STACKS'))} ${c.blue(stacksVersion)}`)

        for (const [option, url] of Object.entries(urls)) {
          if (options && options[option as keyof StacksPluginOptions]) {
            console.log(`  ${c.green('➜')}  ${c.bold(option.charAt(0).toUpperCase() + option.slice(1))}: ${c.green(url)}`)
          }
        }

        // there is a chance the above loop is not triggered, in a case we are serving a single dev server
        // that's why the below is needed
        if (options && options.config?.includes('frontend')) {
          console.log(`  ${c.green('➜') }  ${c.bold('Frontend')}: ${c.green(urls.frontend)}`)
          console.log(`  ${c.green('➜') }  ${c.bold('Local')}: ${c.green(await localUrl({ type: 'frontend', localhost: true }))}`)
          console.log(`  ${c.green('➜') }  ${c.bold('Network')}: ${c.green(await localUrl({ type: 'frontend', network: true }))}`)
        }

        if (options && options.config?.includes('components')) {
          console.log(`  ${c.green('➜') }  ${c.bold('Components')}: ${c.green(urls.library)}`)
          console.log(`  ${c.green('➜') }  ${c.bold('Local')}: ${c.green(await localUrl({ type: 'library', localhost: true }))}`)
          console.log(`  ${c.green('➜') }  ${c.bold('Network')}: ${c.green(await localUrl({ type: 'library', network: true }))}`)
        }

        if (options && options.config?.includes('email'))
          console.log(`  ${c.green('➜') }  ${c.bold('Email')}: ${c.green(urls.email)}`)
        if (options && options.config?.includes('docs'))
          console.log(`  ${c.green('➜') }  ${c.bold('Docs')}: ${c.green(urls.docs)}`)
        if (options && options.config?.includes('inspect'))
          console.log(`  ${c.green('➜') }  ${c.bold('Inspect')}: ${c.green(urls.inspect)}`)
        if (options && options.config?.includes('admin'))
          console.log(`  ${c.green('➜') }  ${c.bold('Admin')}: ${c.green(urls.admin)}`)
        if (options && options.config?.includes('backend'))
          console.log(`  ${c.green('➜') }  ${c.bold('Backend')}: ${c.green(urls.backend)}`)
        if (options && options.config?.includes('desktop'))
          console.log(`  ${c.green('➜') }  ${c.bold('Desktop')}: ${c.green(urls.desktop)}`)
      }
    },
  }
}
