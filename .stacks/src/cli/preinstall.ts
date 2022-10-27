import type { CLI } from '@stacksjs/types'
import { runPreinstall } from './actions/preinstall'

async function preinstall(stacks: CLI) {
  stacks
    .command('preinstall', 'Run your preinstall script.')
    .action(async () => {
      await runPreinstall()
    })
}

export { preinstall }
