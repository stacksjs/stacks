import type { CLI, FreshOptions } from '@stacksjs/types'
import { invoke } from '@stacksjs/actions/commit'

async function commit(buddy: CLI) {
  const descriptions = {
    commit: 'Commit your stashed changes',
    verbose: 'Enable verbose output',
    debug: 'Enable debug mode',
  }

  buddy
    .command('commit', descriptions.commit)
    .option('--verbose', descriptions.verbose, { default: false })
    .option('--debug', descriptions.debug, { default: false })
    .action(async (options: FreshOptions) => {
      await invoke(options)
    })
}

export { commit }
