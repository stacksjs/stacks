import process from 'node:process'
import { cli as command } from '@stacksjs/cli'
import { startProxy } from '../src/start'
import { config } from '../src/config'
import { version } from '../package.json'

const cli = command('reverse-proxy')

cli
  .command('start', 'Start the Reverse Proxy Server')
  .action(async () => {
    // eslint-disable-next-line no-console
    console.log('config', config)

    if (!config) {
      console.error('No config found')
      process.exit(1)
    }

    // Assuming config is an object where each key-value pair represents a proxy mapping
    for (const [from, to] of Object.entries(config))
      await startProxy({ from, to }) // Ensure startProxy can handle being called like this
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
