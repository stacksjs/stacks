import { alias } from '@stacksjs/alias'
import { kolorist as c } from '@stacksjs/cli'
import { docs } from '@stacksjs/config'
import { path as p } from '@stacksjs/path'
import { server } from '@stacksjs/server'
import { withPwa } from '@vite-pwa/vitepress'
import { defineConfig } from 'vitepress'
import type { UserConfig } from 'vitepress'
import { version } from '../package.json'
import { pwaDocs as pwa } from './scripts/pwa'

export const frameworkDefaults = {
  base: '/docs/',
  cleanUrls: true,
  srcDir: p.projectPath('docs'),
  outDir: p.projectStoragePath('framework/docs'),
  cacheDir: p.projectStoragePath('framework/cache/docs'),
  assetsDir: p.assetsPath(),
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
        configureServer(server) {
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
} satisfies UserConfig

const config: UserConfig = {
  ...frameworkDefaults,
  ...docs,
}

export default withPwa(defineConfig(config))

export * from './plugins'
export * from './scripts/pwa'
export * from './meta'
