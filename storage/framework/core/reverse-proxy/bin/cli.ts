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
  .example('reverse-proxy start --from localhost:3000 --to my-project.localhost')
  .example('reverse-proxy start --from localhost:3000 --to localhost:3001')
  .example('reverse-proxy start --from localhost:3000 --to my-project.test --keyPath /absolute/path/to/key --certPath /absolute/path/to/cert')
  .action(async (options?: Options) => {
    if (options?.from || options?.to) {
      startProxy({
        from: options?.from ?? 'localhost:3000',
        to: options?.to ?? 'stacks.localhost',
        keyPath: options?.keyPath,
        certPath: options?.certPath,
      })

      return
    }

    // loop over the config and start all the proxies
    if (config) {
      for (const [from, to] of Object.entries(config)) {
        startProxy({
          from,
          to,
          keyPath: options?.keyPath,
          certPath: options?.certPath,
        })
      }
    }
    else {
      // eslint-disable-next-line no-console
      console.log('No proxies found in the config')
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
