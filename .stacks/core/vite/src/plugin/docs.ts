import { kolorist as c } from '@stacksjs/cli'
import type { ViteDevServer } from '../'
import pkg from '../../../../package.json'
import { app } from '@stacksjs/config'

const { version } = pkg

function docsUrl() {
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

export const docsEngine = {
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
}
