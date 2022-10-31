import type { CLI, PrepublishOptions } from '@stacksjs/types'
import { invoke } from './actions/prepublish'

const descriptions = {
  command: 'Run your prepublish script',
  debug: 'Add additional debug logging',
}

async function prepublish(stacks: CLI) {
  stacks
    .command('prepublish', descriptions.command)
    .option('--debug', descriptions.debug, { default: false })
    .action(async (options: PrepublishOptions) => {
      await invoke(options)
    })
}

export { prepublish }
