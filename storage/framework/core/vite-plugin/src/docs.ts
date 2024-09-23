import { kolorist as c } from '@stacksjs/cli'
import type { ViteDevServer } from 'vite'
import type { Plugin } from 'vite'
import { version } from '../../package.json'

export const docsEngine: Plugin = {
  name: 'stacks-plugin',
  configureServer(server: ViteDevServer) {
    // const base = server.config.base || '/'
    // const _print = server.printUrls
    server.printUrls = () => {
      console.log(`  ${c.blue(c.bold('STACKS'))} ${c.blue(version)}`)

      // console.log(`  ${c.green('➜')}  ${c.bold('Docs')}: ${c.green(docsUrl())}`)
    }
  },
}
