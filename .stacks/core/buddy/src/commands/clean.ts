import type { CLI, CleanOptions } from '@stacksjs/types'
import { runAction } from '@stacksjs/actions'
import { Action } from '@stacksjs/types'

async function clean(buddy: CLI) {
  const descriptions = {
    clean: 'Removes all node_modules & lock files',
    verbose: 'Enable verbose output',
    debug: 'Enable debug mode',
  }

  buddy
    .command('clean', descriptions.clean)
    .option('--verbose', descriptions.verbose, { default: false })
    .option('--debug', descriptions.debug, { default: false })
    .action(async (options: CleanOptions) => {
      await runAction(Action.Clean, options)
    })
}

export { clean }
