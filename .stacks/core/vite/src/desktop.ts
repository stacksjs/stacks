import { type ViteConfig } from '@stacksjs/types'
import { path as p } from '@stacksjs/path'
import { cssEngine, inspect, autoImports, components, layouts, pages, uiEngine } from './stacks'
import { alias } from '@stacksjs/alias'
import { defineConfig } from './'
import generateSitemap from 'vite-ssg-sitemap'

import UnoCSS from 'unocss/vite'

export const pagesConfig = {
  root: p.projectStoragePath('framework/desktop/dashboard'),
  envDir: p.projectPath(),
  envPrefix: 'FRONTEND_',
  publicDir: p.projectPath('public'),

  resolve: {
    alias,
  },

  server: {
    host: '127.0.0.1',
    port: 3333,
  },

  plugins: [
    uiEngine(),
    pages({
      dirs: p.frameworkPath('stacks/dashboard/src/pages'),
    }),
    UnoCSS({
      configFile: p.corePath('vite/src/uno.config.ts')
    }),
    layouts({
      layoutsDirs: p.frameworkPath('stacks/dashboard/src/layouts'),
    }),
<<<<<<< Updated upstream
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
          const docsUrl = `https://${appUrl}/docs`

          // const pkg = await storage.readPackageJson(frameworkPath('./package.json')) // TODO: fix this async call placing `press h to show help` on top
          const stacksVersion = `alpha-${version}`

          // eslint-disable-next-line no-console
          console.log(`  ${c.blue(c.bold('STACKS'))} ${c.blue(stacksVersion)}`)
          // eslint-disable-next-line no-console
          console.log(`  ${c.green('➜')}  ${c.bold('Docs')}: ${c.green(docsUrl)}`)
        }
      },
    },
=======
>>>>>>> Stashed changes
  ],

  // https://github.com/antfu/vite-ssg
  ssgOptions: {
    script: 'async',
    formatting: 'minify',
    onFinished() { generateSitemap() },
  },

  ssr: {
    // TODO: workaround until they support native ESM
    noExternal: ['workbox-window', /vue-i18n/],
  },
} satisfies ViteConfig

export default defineConfig(({ command }) => {
  if (command === 'serve')
    return pagesConfig

  // command === 'build'
  return pagesConfig
})
