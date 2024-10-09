import type { ViteDevServer } from 'vite'
import { kolorist as c } from '@stacksjs/cli'
import { version } from '../../package.json'

export const docsEngine = {
  name: 'stacks-plugin',
  configureServer(server: ViteDevServer): void {
    // const base = server.config.base || '/'
    // const _print = server.printUrls
    server.printUrls = () => {
      // eslint-disable-next-line no-console
      console.log(`  ${c.blue(c.bold('STACKS'))} ${c.blue(version)}`)

      // console.log(`  ${c.green('➜')}  ${c.bold('Docs')}: ${c.green(docsUrl())}`)
    }
  },
}
