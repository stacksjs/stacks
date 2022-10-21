import type { CAC } from 'cac'
import { generateTypes } from './actions/types'

async function types(artisan: CAC) {
  artisan
    .command('types:generate', 'Generate the types of & for your library/libraries')
    .action(async () => {
      await generateTypes()
    })

  artisan
    .command('types:fix', 'Generate the types of & for your library/libraries')
    .action(async () => {
      // await fixTypes()
    })
}

export { types }
