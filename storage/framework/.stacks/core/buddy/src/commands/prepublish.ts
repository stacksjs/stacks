import process from 'node:process'
import type { CLI, PrepublishOptions } from 'stacks:types'
import { Action } from 'stacks:enums'
import { runAction } from 'stacks:actions'

export function prepublish(buddy: CLI) {
  const descriptions = {
    command: 'Run your prepublish script',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('prepublish', descriptions.command)
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: PrepublishOptions) => {
      await runAction(Action.Prepublish, options)
    })

  buddy.on('prepublish:*', () => {
    console.error('Invalid command: %s\nSee --help for a list of available commands.', buddy.args.join(' '))
    process.exit(1)
  })
}
