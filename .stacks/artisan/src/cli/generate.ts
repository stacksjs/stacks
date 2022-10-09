import type { CAC } from 'cac'
import { generateLibEntries, generateTypes, generateVueCompat, generateWebTypes } from '../actions/generate'

async function generateCommands(artisan: CAC) {
  artisan
    .command('generate:types', 'Generates the types of & for your library/libraries')
    .action(async () => {
      await generateTypes()
    })

  artisan
    .command('generate:entries', 'Generates the entry points for your libraries')
    .action(async () => {
      // run the generate:entries command
      await generateLibEntries()
    })

  artisan
    .command('generate:vue-compatibility', 'Generates Vue 2 & 3 compatibility')
    .action(async () => {
      await generateVueCompat()
    })

  artisan
    .command('generate:web-types', 'Generates web-types.json for IDEs')
    .action(async () => {
      await generateWebTypes()
    })
}

export { generateCommands }
