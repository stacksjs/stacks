import { alias } from '@stacksjs/alias'
import { pwaDocs as pwa } from '@stacksjs/docs'
import { path as p } from '@stacksjs/path'
import { server } from '@stacksjs/server'
import { withPwa } from '@vite-pwa/vitepress'
import { defineConfig } from 'vitepress'
import { transformerTwoslash } from 'vitepress-plugin-twoslash'
import userConfig from '../../../../docs/config'
import { analyticsHead, faviconHead } from './head'

// import { config } from '@stacksjs/config'
// import { kolorist as c } from '@stacksjs/cli'
// import { version } from '../../../../stacks/package.json'

// https://vitepress.dev/reference/site-config
export default withPwa(
  defineConfig({
    srcDir: p.projectPath('docs'),
    outDir: p.frameworkPath('docs/dist'),
    cacheDir: p.frameworkPath('cache/docs'),
    assetsDir: '/assets',

    // sitemap: {
    //   hostname: 'stacks.localhost',
    // },

    vite: {
      publicDir: p.publicPath(),
      build: {
        assetsDir: 'assets',
        rollupOptions: {
          output: {
            assetFileNames: 'assets/[name].[hash][extname]',
          },
        },
      },

      server: server({
        type: 'docs',
      }),

      resolve: {
        alias,
      },

      // plugins: [
      //   {
      //     name: 'stacks-plugin',
      //     configureServer(server) {
      //       // const base = server.config.base || '/'
      //       // const _print = server.printUrls
      //       server.printUrls = () => {
      //         console.log(`  ${c.blue(c.bold('STACKS'))} ${c.blue(version)}`)
      //         // console.log(`  ${c.green('➜')}  ${c.bold('Docs')}: ${c.cyan('http://stacks.localhost:3000/docs')}`)
      //         console.log(`  ${c.green('➜')}  ${c.bold('Docs')}: ${c.cyan('https://stacks.localhost/docs')}`)
      //       }
      //     },
      //   },
      // ],
    },

    head: [...faviconHead, ...analyticsHead],

    pwa,

    markdown: {
      codeTransformers: [transformerTwoslash()],
    },

    ...userConfig,
  }),
)
