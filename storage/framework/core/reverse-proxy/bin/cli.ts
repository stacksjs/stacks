import { cli as command } from '@stacksjs/cli'
import { startProxy } from '../src/start'
import { version } from '../package.json'

const cli = command('reverse-proxy')

cli
  .command('start', 'Start the Reverse Proxy Server')
  .action(() => {
    const option = {
      from: 'localhost:3006',
      to: 'stacksjs.localhost',
    }

    startProxy(option)
  })

cli
  .command('version', 'Show the version of the Reverse Proxy CLI')
  .action(() => {
    // eslint-disable-next-line no-console
    console.log(version)
  })

cli.version(version)
cli.help()
cli.parse()
