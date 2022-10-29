import type { CLI } from '@stacksjs/types'
import { invoke } from './actions/prepublish'

async function prepublish(stacks: CLI) {
  stacks
    .command('prepublish', 'Run your prepublish script.')
    .action(async () => {
      await invoke()
    })
}

export { prepublish }
