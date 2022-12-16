import type { CLI, CleanOptions } from '@stacksjs/types'
import { invoke } from '@stacksjs/actions/clean'

async function clean(buddy: CLI) {
  const descriptions = {
    clean: 'Removes all node_modules & lock files',
    debug: 'Enable debug mode',
  }

  buddy
    .command('clean', descriptions.clean)
    .option('--debug', descriptions.debug, { default: false })
    .action(async (options: CleanOptions) => {
      await invoke(options)
    })
}

export { clean }
