import { alias } from '@stacksjs/alias'
import { kolorist as c } from '@stacksjs/cli'
import { config } from '@stacksjs/config'
import { path as p } from '@stacksjs/path'
import { server } from '@stacksjs/server'
import type { UserConfig } from 'vitepress'
import userConfig from '../../../../config/docs'
import { version } from '../../../../.stacks/package.json'
import { analyticsHead, faviconHead } from './head'

// this is the resolved user config
export default {
  // ...frameworkDefaults,
  base: config.app.docMode ? '/' : '/docs/',
  cleanUrls: true,
  srcDir: p.projectPath('docs'),
  outDir: p.projectStoragePath('framework/docs/dist'),
  cacheDir: p.projectStoragePath('framework/cache/docs'),
  lastUpdated: true,

  // sitemap: {
  //   hostname: 'stacks.test',
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
          server.printUrls = () => { // eslint-disable-next-line no-console
            console.log(`  ${c.blue(c.bold('STACKS'))} ${c.blue(version)}`)

            // console.log(`  ${c.green('➜')}  ${c.bold('Docs')}: ${c.green('http://stacks.test:3333/docs')}`)
            // eslint-disable-next-line no-console
            console.log(`  ${c.green('➜')}  ${c.bold('Docs')}: ${c.green('https://stacks.localhost/docs')}`)
          }
        },
      },
    ],
  },

  head: [
    ...faviconHead,
    ...analyticsHead,
  ],

  ...userConfig,
} satisfies UserConfig
