import { kolorist as c } from '@stacksjs/cli'
import { app } from '@stacksjs/config'
import type { ViteDevServer } from '../'
import pkg from '../../../../package.json'

const { version } = pkg

function docsUrl() {
  const appUrl = app.url || 'stacks.test'
  const protocolPattern = /^https?:\/\//i
  const urlForParsing = protocolPattern.test(appUrl) ? appUrl : `http://${appUrl}:3333/docs`
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
