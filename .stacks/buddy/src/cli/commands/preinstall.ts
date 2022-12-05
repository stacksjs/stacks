import type { CLI, PreinstallOptions } from '@stacksjs/types'
import { invoke } from '@stacksjs/actions/cli/preinstall'

const descriptions = {
  command: 'Run your preinstall script',
  debug: 'Enable debug mode',
}

async function preinstall(stacks: CLI) {
  stacks
    .command('preinstall', descriptions.command)
    .option('--debug', descriptions.debug, { default: false })
    .action(async (options: PreinstallOptions) => {
      await invoke(options)
    })
}

export { preinstall }
