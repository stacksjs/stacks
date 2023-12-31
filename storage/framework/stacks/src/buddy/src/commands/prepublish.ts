import process from 'node:process'
import type { CLI, PrepublishOptions } from 'src/types/src'
import { Action } from 'src/enums/src'
import { runAction } from 'src/actions/src'

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
