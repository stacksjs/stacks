import type { CLI, CleanOptions } from '@stacksjs/types'
import { invoke } from '../actions/clean'

const descriptions = {
  clean: 'Removes all node_modules & lock files',
  debug: 'Enable debug mode',
}

async function clean(stacks: CLI) {
  stacks
    .command('clean', descriptions.clean)
    .option('--debug', descriptions.debug, { default: false })
    .action(async (options: CleanOptions) => {
      await invoke(options)
    })
}

export { clean }
