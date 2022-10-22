import type { CAC } from 'cac'
import { generateTypes } from './actions/types'

async function types(stacks: CAC) {
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
