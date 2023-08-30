import type { ViteConfig } from '@stacksjs/types'
import * as p from '@stacksjs/path'
import { alias } from '@stacksjs/alias'
import * as c from 'kolorist'
import { app } from '@stacksjs/config'
import { server } from '@stacksjs/server'
import pkgjson from '../package.json'
import { cssEngine, inspect, layouts, pages, uiEngine } from './stacks'
import type { ViteDevServer as DevServer } from './'
import { defineConfig } from './'

const { version } = pkgjson

export const vueComponentsConfig: ViteConfig = {
  root: p.frameworkPath('views/desktop/dashboard'),
  envDir: p.projectPath(),
  envPrefix: 'FRONTEND_',
  publicDir: p.projectStoragePath('public'),

  server: server({
    type: 'desktop',
  }),

  resolve: {
    dedupe: ['vue'],
    alias,
  },

  optimizeDeps: {
    exclude: ['vue'],
  },

  plugins: [
    // preview(),
    pages({
      routesFolder: ['../../stacks/dashboard/src/pages'],
    }),
    layouts({
      layoutsDirs: '../../../stacks/dashboard/src/layouts',
    }),
    uiEngine(),
    cssEngine(),
    inspect(),

    // @ts-expect-error TODO: fix this
    {
      // ...
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

          const urlObj = new URL(app.url)
          const domainParts = urlObj.hostname.split('.')
          domainParts[domainParts.length - 1] = 'test' // replace TLD with 'test'
          const newHostname = domainParts.join('.')

          const appUrl = newHostname
          const docsSubdomain = app.subdomains.docs
          const docsUrl = `https://${docsSubdomain}.${appUrl}`

          // const pkg = await storage.readPackageJson(frameworkPath('./package.json')) // TODO: fix this async call placing `press h to show help` on top
          const stacksVersion = `alpha-${version}`

          // eslint-disable-next-line no-console
          console.log(`  ${c.blue(c.bold('STACKS'))} ${c.blue(stacksVersion)}`)
          // eslint-disable-next-line no-console
          console.log(`  ${c.green('➜')}  ${c.bold('Docs')}: ${c.green(docsUrl)}`)
        }
      },
    },
  ],
}

export default defineConfig(({ command }) => {
  // process.env = { ...process.env, ...loadEnv(mode, projectPath(), '') }

  if (command === 'serve')
    return vueComponentsConfig

  return vueComponentsConfig
})
