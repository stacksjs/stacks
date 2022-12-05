import type { CLI, PrepublishOptions } from '@stacksjs/types'
import { invoke } from '@stacksjs/actions/buddy/prepublish'

const descriptions = {
  command: 'Run your prepublish script',
  debug: 'Enable debug mode',
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
