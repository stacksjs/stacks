import process from 'node:process'
import type { CLI, CheckOptions } from '@stacksjs/types'
import { ExitCode } from '@stacksjs/types'
import { Action } from '@stacksjs/enums'
import { runAction } from '@stacksjs/actions'
import { log } from 'stacks/logging'
import { intro, outro } from 'stacks/cli'

export function check(buddy: CLI) {
  const descriptions = {
    command: 'Let buddy check your project for potential issues and misconfigurations',
    ports: 'Check if the ports are available',
    project: 'Target a specific project',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('check [type]', descriptions.command)
    .option('--ports', descriptions.ports)
    .option('-p, --project', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (type: string | undefined, options: CheckOptions) => {
      log.debug('Running `buddy check [type]` ...', options)

      const perf = await intro('buddy check [type]')

      switch (type) {
        case 'ports':
          await runAction(Action.CheckPorts)
          return
      }

      if (options.ports)
        await runAction(Action.CheckPorts, options)

      // await runAction(Action.Prepublish, options)
      await outro('Exited', { startTime: perf, useSeconds: true })
      process.exit(ExitCode.Success)
    })

  buddy.on('check:*', () => {
    console.error('Invalid command: %s\nSee --help for a list of available commands.', buddy.args.join(' '))
    process.exit(1)
  })
}
