import type { CLI, PrepublishOptions } from '@stacksjs/types'
import { Action } from '@stacksjs/types'
import { runAction } from '@stacksjs/actions'

async function prepublish(buddy: CLI) {
  const descriptions = {
    command: 'Run your prepublish script',
    verbose: 'Enable verbose output',
    debug: 'Enable debug mode',
  }

  buddy
    .command('prepublish', descriptions.command)
    .option('--verbose', descriptions.verbose, { default: false })
    .option('--debug', descriptions.debug, { default: false })
    .action(async (options: PrepublishOptions) => {
      await runAction(Action.Prepublish, options)
    })
}

export { prepublish }
