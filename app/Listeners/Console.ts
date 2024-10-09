import type { CLI } from '@stacksjs/types'
import process from 'node:process'

export default function (cli: CLI) {
  // Listen to the `inspire:three` command
  cli.on('inspire:three', () => {
    // eslint-disable-next-line no-console
    console.log('inspiring with three quotes')
    // Do something
  })

  // Listen to the default command
  cli.on('inspire:!', () => {
    // Do something
  })

  // Listen to unknown commands
  cli.on('inspire:*', () => {
    console.error('Invalid command: %s', cli.args.join(' '))
    process.exit(1)
  })
}
