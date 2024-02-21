import process from 'node:process'
import type { CLI, CheckOptions } from '@stacksjs/types'
import { ExitCode } from '@stacksjs/types'
import { log } from '@stacksjs/logging'

// import { intro, outro } from '@stacksjs/cli'
// import { config } from '@stacksjs/config'

export function ports(buddy: CLI) {
  const descriptions = {
    command: 'Let buddy check your project for potential issues and misconfigurations',
    ports: 'Check if the ports are available',
    project: 'Target a specific project',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('ports', descriptions.command)
    .option('-p, --project', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: CheckOptions) => {
      log.debug('Running `buddy check [type]` ...', options)

      // const perf = await intro('buddy check [type]')
      // const ports = config.ports
      // await runAction(Action.Prepublish, options)
      // await outro('Exited', { startTime: perf, useSeconds: true })
      process.exit(ExitCode.Success)
    })

  buddy.on('check:*', () => {
    console.error('Invalid command: %s\nSee --help for a list of available commands.', buddy.args.join(' '))
    process.exit(1)
  })
}
