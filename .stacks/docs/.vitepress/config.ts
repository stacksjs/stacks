import { path as p } from '@stacksjs/path'
import { app } from '@stacksjs/config'
import { server } from '@stacksjs/server'
import { alias } from '@stacksjs/alias'
import { kolorist as c } from '@stacksjs/cli'
import { ViteDevServer } from '@stacksjs/vite'
import type { UserConfig } from 'vitepress'
import pkg from '../../package.json'

function docsUrl() {
  const appUrl = app.url || "stacks.test"
  const docsSubdomain = app.subdomains?.docs || "docs"
  const protocolPattern = /^https?:\/\//i
  const urlForParsing = protocolPattern.test(appUrl) ? appUrl : `http://${docsSubdomain}.${appUrl}:3333`
  const urlObj = new URL(urlForParsing)
  const domainParts = urlObj.hostname.split(".")
  domainParts[domainParts.length - 1] = "localhost"
  const host = domainParts.join(".")
  return `https://${host}`
}

const { version } = pkg

const docs = {
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
      {
        name: 'stacks-plugin',
        configureServer(server: ViteDevServer) {
          // const base = server.config.base || '/'
          // const _print = server.printUrls
          server.printUrls = () => { // eslint-disable-next-line no-console
            console.log(`  ${c.blue(c.bold('STACKS'))} ${c.blue(version)}`)
            // eslint-disable-next-line no-console
            console.log(`  ${c.green('➜')}  ${c.bold('Docs')}: ${c.green(docsUrl())}`)
          }
        },
      },
    ],
  },
} satisfies UserConfig

export default docs
