import type { CLI, FreshOptions } from '@stacksjs/types'
import { invoke } from '@stacksjs/actions/commit'

async function commit(buddy: CLI) {
  const descriptions = {
    commit: 'Commit your stashed changes',
    debug: 'Enable debug mode',
  }

  buddy
    .command('commit', descriptions.commit)
    .option('--debug', descriptions.debug, { default: false })
    .action(async (options: FreshOptions) => {
      await invoke(options)
    })
}

export { commit }
