import { kolorist as c } from '@stacksjs/cli'

// @ts-expect-error - unsure why this is an error because those are valid exports
import type { ViteDevServer } from 'vite'
import { version } from '../../package.json'

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
