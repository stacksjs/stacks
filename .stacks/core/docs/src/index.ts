import { defineConfig } from 'vitepress'
import { path as p } from '@stacksjs/path'
import { app, docs } from '@stacksjs/config'
import * as c from 'kolorist'
import type { ViteDevServer as DevServer } from '../../vite/src'
import pkgjson from '../package.json'

const { version } = pkgjson

const appUrl = app.url
const docsSubdomain = app.subdomains.docs
const protocolPattern = /^https?:\/\//i
const urlForParsing = protocolPattern.test(appUrl) ? appUrl : `http://${docsSubdomain}.${appUrl}:3333`
const urlObj = new URL(urlForParsing)
const domainParts = urlObj.hostname.split('.')
domainParts[domainParts.length - 1] = 'test' // replace TLD with 'test' for local dev
const host = domainParts.join('.')
const docsUrl = `http://${host}`

const defaultConfig = {
  title: 'StacksJS',
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
}

const config = {
  ...defaultConfig,
  ...docs,
}

export default defineConfig(config)
