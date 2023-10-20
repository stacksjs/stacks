import { alias } from '@stacksjs/alias'
import { kolorist as c } from '@stacksjs/cli'
import { config } from '@stacksjs/config'
import { path as p } from '@stacksjs/path'
import { server } from '@stacksjs/server'
import type { HeadConfig, UserConfig } from 'vitepress'
import analytics from '../../../config/analytics'
import userConfig from '../../../config/docs'
import { version } from '../../package.json'

const googleAnalyticsHead: HeadConfig[] = [
  [
    'script',
    { async: '', src: `https://www.googletagmanager.com/gtag/js?id=${analytics.drivers?.googleAnalytics?.trackingId}` },
  ],
  [
    'script',
    {},
      `window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', 'TAG_ID');`,
  ],
]

const fathomAnalyticsHead: HeadConfig[] = [
  [
    'script',
    { 'src': 'https://cdn.usefathom.com/script.js', 'data-site': analytics.drivers?.fathom?.siteId || '', 'defer': '' },
  ],
]

const analyticsHead = analytics.driver === 'fathom'
  ? fathomAnalyticsHead
  : analytics.driver === 'google-analytics'
    ? googleAnalyticsHead
    : []

const faviconHead: HeadConfig[] = [
  [
    'link',
    {
      rel: 'icon',
      href: '/favicon.png',
    },
  ],
]

// this is the resolved user config
export default {
  // ...frameworkDefaults,
  base: config.app.docMode ? '/' : '/docs/',
  cleanUrls: true,
  srcDir: p.projectPath('docs'),
  outDir: p.projectStoragePath('framework/docs'),
  cacheDir: p.projectStoragePath('framework/cache/docs'),
  // @ts-expect-error - this may not be specified so we need to set a default
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
