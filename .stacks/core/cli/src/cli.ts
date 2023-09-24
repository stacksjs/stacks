// import type { CliOptions } from '@stacksjs/types'
import cac from 'cac'
import { version } from '../package.json'

interface CliOptions {
  name?: string
  version: string
  description: string
}

export function cli(name?: string | CliOptions, options?: CliOptions) {
  if (typeof name === 'object') {
    options = name
    name = options.name
  }

  const cli = cac(name)

  // cli.on('command:*', () => {
  //   console.error('Invalid command: %s\nSee --help for a list of available commands.', cli.args.join(' '))
  //   process.exit(1)
  // })

  cli.help()
  cli.version(options?.version || version)

  return cli
}
