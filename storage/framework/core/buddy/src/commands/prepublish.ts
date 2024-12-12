import type { CLI, PrepublishOptions } from '@stacksjs/types'
import process from 'node:process'
import { runAction } from '@stacksjs/actions'
import { Action } from '@stacksjs/enums'
import { log } from '@stacksjs/logging'

export function prepublish(buddy: CLI): void {
  const descriptions = {
    command: 'Run your prepublish script',
    project: 'Target a specific project',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('prepublish', descriptions.command)
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: PrepublishOptions) => {
      log.debug('Running `buddy prepublish` ...', options)

      await runAction(Action.Prepublish, options)
    })

  buddy.on('prepublish:*', () => {
    console.error('Invalid command: %s\nSee --help for a list of available commands.', buddy.args.join(' '))
    process.exit(1)
  })
}
