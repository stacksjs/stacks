import { ViteDevServer as DevServer } from '../'
import { app } from '@stacksjs/config'
import { kolorist as c } from '@stacksjs/cli'
import pkg from '../../../../package.json'

export function docsEngine() {
  const { version } = pkg
  const appUrl = app.url
  const docsSubdomain = app.subdomains.docs
  const protocolPattern = /^https?:\/\//i
  const urlForParsing = protocolPattern.test(appUrl) ? appUrl : `http://${docsSubdomain}.${appUrl}:3333`
  const urlObj = new URL(urlForParsing)
  const domainParts = urlObj.hostname.split('.')
  domainParts[domainParts.length - 1] = 'test' // replace TLD with 'test' for local dev
  const host = domainParts.join('.')
  const docsUrl = `http://${host}`

  return {
    name: 'stacks-plugin',
    configureServer(server: DevServer) {
      // const base = server.config.base || '/'
      // const _print = server.printUrls
      server.printUrls = () => { // eslint-disable-next-line no-console
        console.log(`  ${c.blue(c.bold('STACKS'))} ${c.blue(version)}`)
        // eslint-disable-next-line no-console
        console.log(`  ${c.green('➜')}  ${c.bold('Docs')}: ${c.green(docsUrl)}`)
      }
    }
  }
}
