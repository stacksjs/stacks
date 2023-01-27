import type { CLI, CleanOptions } from '@stacksjs/types'
import { invoke } from '@stacksjs/actions/clean'

async function clean(buddy: CLI) {
  const descriptions = {
    clean: 'Removes all node_modules & lock files',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('clean', descriptions.clean)
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: CleanOptions) => {
      await invoke(options)
    })
}

export { clean }
