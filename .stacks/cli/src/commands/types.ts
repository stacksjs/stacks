import type { CAC } from 'cac'
import { generateTypes } from '../actions/generate'

async function types(artisan: CAC) {
  artisan
    .command('types:generate', 'Generate the types of & for your library/libraries')
    .action(async () => {
      await generateTypes()
    })
}

export { types }
