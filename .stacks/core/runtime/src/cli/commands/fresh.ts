import type { CLI, CommitOptions } from '@stacksjs/types'
import { invoke } from '../actions/fresh'

const descriptions = {
  fresh: 'Reinstalls your npm dependencies',
  debug: 'Enable debug mode',
}

async function fresh(stacks: CLI) {
  stacks
    .command('fresh', descriptions.fresh)
    .option('--debug', descriptions.debug, { default: false })
    .action(async (options: CommitOptions) => {
      await invoke(options)
    })
}

export { fresh }
