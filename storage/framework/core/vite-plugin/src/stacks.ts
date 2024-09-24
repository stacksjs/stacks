import { kolorist as c, parseOptions } from '@stacksjs/cli'
import { localUrl } from '@stacksjs/config'
import type { ViteDevServer as DevServer, Plugin } from 'vite'
import { version } from '../../package.json'

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

// https://github.com/hannoeru/vite-plugin-pages
export function stacks(options?: StacksPluginOptions): Plugin {
  if (!options) options = parseOptions() as StacksPluginOptions

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

        console.log('urls', urls)
        const stacksVersion = `alpha-v${version}`
        const withLocalhost = options?.withLocalhost

        console.log(`  ${c.blue(c.bold('STACKS'))} ${c.blue(stacksVersion)}`)
        console.log('')

        for (const [option, url] of Object.entries(urls)) {
          if (options?.[option as keyof StacksPluginOptions])
            console.log(
              `  ${c.green('➜')}  ${c.bold(option.charAt(0).toUpperCase() + option.slice(1))}: ${c.green(url)}`,
            )
        }

        // there is a chance the above loop is not triggered, in a case we are serving a single dev server
        // that's why the below is needed
        if (options?.config?.includes('frontend')) {
          if (withLocalhost)
            console.log(
              `  ${c.green('➜')}  ${c.bold('Local')}:    ${c.cyan(
                await localUrl({ type: 'frontend', localhost: true }),
              )}`,
            )

          console.log(`  ${c.green('➜')}  ${c.bold('Frontend')}: ${c.cyan(urls.frontend)}`)
          console.log(
            `  ${c.green('➜')}  ${c.bold('Network')}:  ${c.cyan(await localUrl({ type: 'frontend', network: true }))}`,
          )
        }

        if (options?.config?.includes('components')) {
          if (withLocalhost)
            console.log(
              `  ${c.green('➜')}  ${c.bold('Local')}:    ${c.cyan(
                await localUrl({ type: 'library', localhost: true }),
              )}`,
            )

          console.log(`  ${c.green('➜')}  ${c.bold('Library')}: ${c.cyan(urls.library)}`)
          console.log(
            `  ${c.green('➜')}  ${c.bold('Network')}: ${c.cyan(await localUrl({ type: 'library', network: true }))}`,
          )
        }

        if (options?.config?.includes('email')) {
          if (withLocalhost)
            console.log(
              `  ${c.green('➜')}  ${c.bold('Local')}: ${c.cyan(await localUrl({ type: 'email', localhost: true }))}`,
            )

          console.log(`  ${c.green('➜')}  ${c.bold('Email')}: ${c.cyan(urls.email)}`)
          console.log(
            `  ${c.green('➜')}  ${c.bold('Network')}: ${c.cyan(await localUrl({ type: 'email', network: true }))}`,
          )
        }

        if (options?.config?.includes('docs')) {
          if (withLocalhost)
            console.log(
              `  ${c.green('➜')}  ${c.bold('Local')}: ${c.cyan(await localUrl({ type: 'docs', localhost: true }))}`,
            )

          console.log(`  ${c.green('➜')}  ${c.bold('Docs')}: ${c.cyan(urls.docs)}`)
          console.log(
            `  ${c.green('➜')}  ${c.bold('Network')}: ${c.cyan(await localUrl({ type: 'docs', network: true }))}`,
          )
        }

        if (options?.config?.includes('inspect')) {
          if (withLocalhost)
            console.log(
              `  ${c.green('➜')}  ${c.bold('Local')}:    ${c.cyan(
                await localUrl({ type: 'inspect', localhost: true }),
              )}`,
            )

          console.log(`  ${c.green('➜')}  ${c.bold('Inspect')}: ${c.cyan(urls.inspect)}`)
          console.log(
            `  ${c.green('➜')}  ${c.bold('Network')}: ${c.cyan(await localUrl({ type: 'inspect', network: true }))}`,
          )
        }

        if (options?.config?.includes('admin')) {
          if (withLocalhost)
            console.log(
              `  ${c.green('➜')}  ${c.bold('Local')}:   ${c.cyan(await localUrl({ type: 'admin', localhost: true }))}`,
            )

          console.log(`  ${c.green('➜')}  ${c.bold('Admin')}:   ${c.cyan(urls.admin)}`)
          console.log(
            `  ${c.green('➜')}  ${c.bold('Network')}: ${c.cyan(await localUrl({ type: 'admin', network: true }))}`,
          )
        }

        if (options?.config?.includes('backend')) {
          if (withLocalhost)
            console.log(
              `  ${c.green('➜')}  ${c.bold('Local')}:   ${c.cyan(
                await localUrl({ type: 'backend', localhost: true }),
              )}`,
            )

          console.log(`  ${c.green('➜')}  ${c.bold('Backend')}: ${c.cyan(urls.backend)}`)
          console.log(
            `  ${c.green('➜')}  ${c.bold('Network')}: ${c.cyan(await localUrl({ type: 'backend', network: true }))}`,
          )
        }

        if (options?.config?.includes('backend')) {
          if (withLocalhost)
            console.log(
              `  ${c.green('➜')}  ${c.bold('Local')}:    ${c.cyan(
                await localUrl({ type: 'backend', localhost: true }),
              )}`,
            )

          console.log(`  ${c.green('➜')}  ${c.bold('Backend')}: ${c.cyan(urls.backend)}`)
          console.log(
            `  ${c.green('➜')}  ${c.bold('Network')}: ${c.cyan(await localUrl({ type: 'backend', network: true }))}`,
          )
        }

        if (options?.config?.includes('desktop')) {
          if (withLocalhost)
            console.log(
              `  ${c.green('➜')}  ${c.bold('Local')}:    ${c.cyan(
                await localUrl({ type: 'desktop', localhost: true }),
              )}`,
            )

          console.log(`  ${c.green('➜')}  ${c.bold('Desktop')}: ${c.cyan(urls.desktop)}`)
          console.log(
            `  ${c.green('➜')}  ${c.bold('Network')}: ${c.cyan(await localUrl({ type: 'desktop', network: true }))}`,
          )
        }
      }
    },
  }
}
