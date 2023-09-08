import { defineConfig } from 'vitepress'
import type { UserConfig } from 'vitepress'
import { alias } from '@stacksjs/alias'
import { path as p } from '@stacksjs/path'
import { app, docs } from '@stacksjs/config'
import { server } from '@stacksjs/server'
import { kolorist as c } from '@stacksjs/cli'
import pkg from '../../../../package.json'

const { version } = pkg

export const nav = [
  { text: 'Config', link: '/config', activeMatch: '/config' },
  {
    text: 'Changelog',
    link: 'https://github.com/stacksjs/stacks/blob/main/CHANGELOG.md',
  },
  { text: 'Blog', link: 'https://updates.ow3.org' },
]

export const sidebar = {
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
        { text: 'APIs', link: '/guide/apis' },
        { text: 'Apps', link: '/guide/apps' },
        { text: 'Buddy', link: '/guide/buddy' },
        { text: 'CI / CD', link: '/guide/ci' },
        { text: 'Composability', link: '/guide/composability' },
        { text: 'Cloud', link: '/guide/cloud' },
        { text: 'Libraries', link: '/guide/libraries' },
        { text: 'Testing', link: '/guide/testing' },
      ],
    },
  ],
}

export function docsUrl() {
  const appUrl = app.url || 'stacks.test'
  const docsSubdomain = app.subdomains?.docs || 'docs'
  const protocolPattern = /^https?:\/\//i
  const urlForParsing = protocolPattern.test(appUrl) ? appUrl : `http://${docsSubdomain}.${appUrl}:3333`
  const urlObj = new URL(urlForParsing)
  const domainParts = urlObj.hostname.split('.')
  domainParts[domainParts.length - 1] = 'localhost' // replace TLD with 'localhost' for local dev
  const host = domainParts.join('.')

  return `https://${host}`
}

export const frameworkDefaults = {
  title: `${app.name} Documentation`,
  srcDir: p.projectPath('docs'),
  outDir: p.projectStoragePath('framework/docs'),
  cacheDir: p.projectStoragePath('framework/cache/docs'),
  sitemap: {
    hostname: docsUrl(),
  },

  themeConfig: {
    nav,
    sidebar,
  },

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
            // eslint-disable-next-line no-console
            console.log(`  ${c.green('➜')}  ${c.bold('Docs')}: ${c.green('http://stacks.test:3333')}`)
            console.log(`  ${c.green('➜')}  ${c.bold('Docs')}: ${c.green(docsUrl())}`)
          }
        },
      },
    ],
  },
} satisfies UserConfig

const config: UserConfig = {
  ...frameworkDefaults,
  ...docs,
}

export default defineConfig(config)
