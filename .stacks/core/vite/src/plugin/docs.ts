import { docsUrl } from '@stacksjs/docs'
import { kolorist as c } from '@stacksjs/cli'
import type { ViteDevServer as DevServer } from '../'
import pkg from '../../../../package.json'

const { version } = pkg

export function docsEngine() {
  return {
    name: 'stacks-plugin',
    configureServer(server: DevServer) {
      // const base = server.config.base || '/'
      // const _print = server.printUrls
      server.printUrls = () => { // eslint-disable-next-line no-console
        console.log(`  ${c.blue(c.bold('STACKS'))} ${c.blue(version)}`)
        // eslint-disable-next-line no-console
        console.log(`  ${c.green('➜')}  ${c.bold('Docs')}: ${c.green(docsUrl())}`)
      }
    },
  }
}
