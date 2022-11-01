#!/usr/bin/env node
import { command, consola, runCommand } from '@stacksjs/cli'
import type { CliOptions } from '@stacksjs/types'
import { ExitCode } from '@stacksjs/types'
import { version } from '../package.json'

const cli = command('stacks')

// setup global error handlers
process.on('uncaughtException', errorHandler)
process.on('unhandledRejection', errorHandler)

async function main() {
  cli
    .command('ensure', 'This command checks whether Node is installed. pnpm is checked via `only-allow` preinstall hook.')
    .option('--debug', 'Add additional debug logging', { default: false })
    .action(async (options: CliOptions) => {
      try {
        await runCommand('pnpm install', options)
        process.exit(ExitCode.Success)
      }
      catch (error) {
        consola.error('There was an error testing your stack.')
        consola.error(error)
        process.exit(ExitCode.FatalError)
      }
    })

  cli
    .command('setup', 'This command installs Node & pnpm.')
    .option('--debug', 'Add additional debug logging', { default: false })
    .action(async (options) => {
      await runCommand('pnpm env use', options)
    })

  cli.help()
  cli.version(version)

  cli.parse()
}

main()

function errorHandler(error: Error): void {
  let message = error.message || String(error)

  if (process.env.DEBUG || process.env.NODE_ENV === 'development')
    message = error.stack || message

  console.error(message)
  process.exit(ExitCode.FatalError)
}
