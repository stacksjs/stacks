import { kolorist as c } from 'stacks:cli'
import type { ViteDevServer } from '../'
import { version } from '../../../../package.json'

export const docsEngine = {
  name: 'stacks-plugin',
  configureServer(server: ViteDevServer) {
    // const base = server.config.base || '/'
    // const _print = server.printUrls
    server.printUrls = () => { // eslint-disable-next-line no-console
      console.log(`  ${c.blue(c.bold('STACKS'))} ${c.blue(version)}`)

      // console.log(`  ${c.green('➜')}  ${c.bold('Docs')}: ${c.green(docsUrl())}`)
    }
  },
}
