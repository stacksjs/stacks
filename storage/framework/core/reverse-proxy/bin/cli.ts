import process from 'node:process'
import { cli as command } from '@stacksjs/cli'
import { startProxy } from '../src/start'
import { config } from '../src/config'
import { version } from '../package.json'

const cli = command('reverse-proxy')

interface Options {
  from?: string
  to?: string
  keyPath?: string
  certPath?: string
}

cli
  .command('start', 'Start the Reverse Proxy Server')
  .option('--from <from>', 'The URL to proxy from')
  .option('--to <to>', 'The URL to proxy to')
  .option('--keyPath <path>', 'Absolute path to the SSL key')
  .option('--certPath <path>', 'Absolute path to the SSL certificate')
  // .option('--project <project>', 'The project to start the proxy for')
  .option('--all', 'Start all proxies', { default: true })
  .example('reverse-proxy start --from localhost:3000 --to my-project.localhost')
  .example('reverse-proxy start --from localhost:3000 --to localhost:3001')
  .example('reverse-proxy start --from localhost:3000 --to my-project.test --keyPath /absolute/path/to/key --certPath /absolute/path/to/cert')
  .action(async (options?: Options) => {
    const from = options?.from

    if (!config) {
      console.error('No config found')
      process.exit(1)
    }

    // Assuming config is an object where each key-value pair represents a proxy mapping
    for (const [from, to] of Object.entries(config)) {
      startProxy({
        from: options?.from ?? from,
        to: options?.to ?? to,
        keyPath: options?.keyPath,
        certPath: options?.certPath,
      })
    }
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
