import type { CLI, FreshOptions } from '@stacksjs/types'
import { invoke } from '../../actions/commit'

const descriptions = {
  commit: 'Commit your stashed changes',
  debug: 'Enable debug mode',
}

async function commit(stacks: CLI) {
  stacks
    .command('commit', descriptions.commit)
    .option('--debug', descriptions.debug, { default: false })
    .action(async (options: FreshOptions) => {
      await invoke(options)
    })
}

export { commit }
