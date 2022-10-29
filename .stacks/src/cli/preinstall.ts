import type { CLI } from '@stacksjs/types'
import { invoke } from './actions/preinstall'

async function preinstall(stacks: CLI) {
  stacks
    .command('preinstall', 'Run your preinstall script.')
    .action(async () => {
      await invoke()
    })
}

export { preinstall }
