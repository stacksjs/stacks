import { alias } from '@stacksjs/alias'
import { kolorist as c } from '@stacksjs/cli'
import { docs } from '@stacksjs/config'
import { path as p } from '@stacksjs/path'
import { server } from '@stacksjs/server'
import type { DocsConfig } from '@stacksjs/types'
import { withPwa } from '@vite-pwa/vitepress'
import type { ViteDevServer } from 'vite'
import { defineConfig } from 'vitepress'
import type { DefaultTheme, UserConfigExport, UserConfig as VitePressConfig } from 'vitepress'
import { version } from '../package.json'
import { pwaDocs as pwa } from './scripts/pwa'

export const frameworkDefaults: VitePressConfig = {
  base: '/docs/',
  cleanUrls: true,
  srcDir: p.projectPath('docs'),
  outDir: p.storagePath('framework/docs'),
  cacheDir: p.storagePath('framework/cache/docs'),
  assetsDir: '/assets',
  // sitemap: {
  //   hostname: 'stacks.localhost',
  // },

  vite: {
    envDir: p.projectPath(),
    envPrefix: 'FRONTEND_',

    server: server({
      type: 'docs',
    }),

    resolve: {
      alias,
    },

    plugins: [
      {
        name: 'stacks-plugin',
        configureServer(server: ViteDevServer) {
          // const base = server.config.base || '/'
          // const _print = server.printUrls
          server.printUrls = () => {
            console.log(`  ${c.blue(c.bold('STACKS'))} ${c.blue(version)}`)

            // console.log(`  ${c.green('➜')}  ${c.bold('Docs')}: ${c.green('http://stacks.localhost:3000/docs')}`)
            console.log(`  ${c.green('➜')}  ${c.bold('Docs')}: ${c.green('https://stacks.localhost/docs')}`)
            console.log(`  ${c.green('➜')}  ${c.bold('Temp URL')}: ${c.green('http://stacksjs.test:3000')}`)
          }
        },
      },
    ],
  },

  pwa,
}

const combinedConfig: VitePressConfig = {
  ...frameworkDefaults,
  ...docs,
}

export * from './plugins'
export * from './scripts/pwa'
export * from './meta'

const conf: Promise<UserConfigExport<DefaultTheme.Config>> = withPwa(defineConfig(combinedConfig))

export default conf
