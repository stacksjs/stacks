import { defineConfig } from 'vitepress'
import type { UserConfig } from 'vitepress'
import { alias } from '@stacksjs/alias'
import { path as p } from '@stacksjs/path'
import { app, docs } from '@stacksjs/config'
import { docsEngine } from '@stacksjs/vite'
import { server } from '@stacksjs/server'

export function docsUrl() {
  const appUrl = app.url
  const docsSubdomain = app.subdomains.docs
  const protocolPattern = /^https?:\/\//i
  const urlForParsing = protocolPattern.test(appUrl) ? appUrl : `http://${docsSubdomain}.${appUrl}:3333`
  const urlObj = new URL(urlForParsing)
  const domainParts = urlObj.hostname.split('.')
  domainParts[domainParts.length - 1] = 'localhost' // replace TLD with 'localhost' for local dev
  const host = domainParts.join('.')
  return `https://${host}`
}

const defaultConfig = {
  title: `${app.name} Documentation`,
  srcDir: p.projectPath('docs'),
  outDir: p.projectStoragePath('framework/docs'),
  cacheDir: p.projectStoragePath('framework/cache/docs'),
  sitemap: {
    hostname: docsUrl(),
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
      docsEngine(),
    ],
  },
} satisfies UserConfig

const config = {
  ...defaultConfig,
  ...docs,
} satisfies UserConfig

export default defineConfig(config)
