import type { CLI, PrepublishOptions } from '@stacksjs/types'
import { Action } from '@stacksjs/types'
import { runAction } from '@stacksjs/actions'

export async function prepublish(buddy: CLI) {
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
}
