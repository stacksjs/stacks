import type { CLI } from '@stacksjs/types'
import { types as generateTypes } from './actions/generate'

async function types(stacks: CLI) {
  stacks
    .command('types:generate', 'Generate the types of & for your library/libraries')
    .action(async () => {
      await generateTypes()
    })

  stacks
    .command('types:fix', 'Generate the types of & for your library/libraries')
    .action(async () => {
      // await fixTypes()
    })
}

export { types }
