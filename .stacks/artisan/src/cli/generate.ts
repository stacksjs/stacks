import type { CAC } from 'cac'
import { generateLibEntry, generateVueCompat } from '../../../core'
import { generateTypes } from '../scripts/generate'

async function generateCommands(artisan: CAC) {
  artisan
    .command('generate:types', 'Generates the types of & for your library/libraries')
    .action(async () => {
      await generateTypes()
    })

  artisan
    .command('generate:entries', 'Generates the entry points for your libraries')
    .action(async () => {
      await generateLibEntry('components')
      await generateLibEntry('functions')
    })

  artisan
    .command('generate:vue-compatibility', 'Generates Vue 2 & 3 compatibility')
    .action(async () => {
      await generateVueCompat()
    })
}

export { generateCommands }
