import type { CLI } from '@stacksjs/types'
import { runPrepublish } from './actions/prepublish'

async function prepublish(stacks: CLI) {
  stacks
    .command('prepublish', 'Run your prepublish script.')
    .action(async () => {
      await runPrepublish()
    })
}

export { prepublish }
