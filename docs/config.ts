import * as c from 'kolorist'
import { path as p } from '../.stacks/core/path/src'
import type { DocsConfig } from '../.stacks/core/types/src/docs'
import type { ViteDevServer as DevServer } from '../.stacks/core/vite/src'
import pkgjson from '../package.json'
import services from '../config/services'
import app from '../config/app'

const { version } = pkgjson

const nav = [
  { text: 'Config', link: '/config', activeMatch: '/config' },
  {
    text: 'Changelog',
    link: 'https://github.com/stacksjs/stacks/blob/main/CHANGELOG.md',
  },
  { text: 'Blog', link: 'https://updates.ow3.org' },
]

const sidebar = {
  '/guide/': [
    {
      text: 'Introduction',
      collapsible: true,
      items: [
        { text: 'What is Stacks?', link: '/guide/what-is-stacks' },
        { text: 'Getting Started', link: '/guide/getting-started' },
        { text: 'Configuration', link: '/guide/config' },
      ],
    },

    {
      text: 'Digging Deeper',
      collapsible: true,
      items: [
        { text: 'How To?', link: '/guide/stacks' },
        { text: 'Workflows / CI', link: '/guide/ci' },
        { text: 'VS Code', link: '/guide/vs-code' },
        { text: 'Apps', link: '/guide/apps' },
        { text: 'Examples', link: '/guide/examples' },
        { text: 'Packages', link: '/guide/packages' },
        { text: 'Testing', link: '/guide/testing' },
        { text: 'Single File Components', link: '/guide/sfcs' },
      ],
    },

    {
      text: 'Starters',
      collapsible: true,
      items: [
        { text: 'Vue Starter', link: '/starter/vue' },
        { text: 'Web Component Starter', link: '/starter/web-components' },
        { text: 'Composable Starter', link: '/starter/web-components' },
        { text: 'TypeScript Starter', link: '/starter/web-components' },
      ],
    },
  ],
}

const appUrl = app.url
const protocolPattern = /^https?:\/\//i
const urlForParsing = protocolPattern.test(appUrl) ? appUrl : `http://${appUrl}:3333`
const urlObj = new URL(urlForParsing)
const domainParts = urlObj.hostname.split('.')
domainParts[domainParts.length - 1] = 'test' // replace TLD with 'test' for local dev
const host = domainParts.join('.')
// const host = 'stacksjs.com'
const docsDomain = `docs.${host}`
const docsUrl = `http://${docsDomain}`

/**
 * **Documentation Options**
 *
 * This configuration defines all of your documentation options. Because Stacks is fully-typed,
 * you may hover any of the options below and the definitions will be provided. In case
 * you have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export default {
  vite: {
    envDir: p.projectPath(),
    envPrefix: 'FRONTEND_',
    server: {
      host,
      port: 3333,
      open: true,
    },

    plugins: [
      {
        name: 'stacks-plugin',
        configureServer(server: DevServer) {
          // const base = server.config.base || '/'
          // const _print = server.printUrls
          server.printUrls = () => { // eslint-disable-next-line no-console
            console.log(`  ${c.blue(c.bold('STACKS'))} ${c.blue(version)}`)
            // eslint-disable-next-line no-console
            console.log(`  ${c.green('➜')}  ${c.bold('Docs')}: ${c.green(docsUrl)}`)
          }
        },
      },
    ],
  },

  srcDir: p.projectPath('docs'),
  outDir: p.projectStoragePath('app/docs'),
  cacheDir: p.projectStoragePath('app/cache/docs'),
  lang: 'en-US',
  title: 'Stacks',
  description: 'Composability-First. UI/FX Framework.',
  lastUpdated: true,

  themeConfig: {
    nav,
    sidebar,

    editLink: {
      pattern: 'https://github.com/stacksjs/stacks/edit/main/docs/docs/:path',
      text: 'Edit this page on GitHub',
    },

    socialLinks: [
      { icon: 'twitter', link: 'https://twitter.com/stacksjs' },
      { icon: 'github', link: 'https://github.com/stacksjs/stacks' },
      { icon: 'discord', link: 'https://discord.com/' },
    ],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2023-present Stacks',
    },

    algolia: services.algolia,

    carbonAds: {
      code: '',
      placement: '',
    },
  },
} satisfies DocsConfig
