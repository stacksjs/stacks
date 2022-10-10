import type { CAC } from 'cac'
import { generateIdeHelpers, generateLibEntries, generateTypes, generateVsCodeCustomData, generateVueCompat, generateWebTypes } from '../actions/generate'

async function generateCommands(artisan: CAC) {
  artisan
    .command('generate:types', 'Generate the types of & for your library/libraries')
    .action(async () => {
      await generateTypes()
    })

  artisan
    .command('generate:entries', 'Generate the entry points for your libraries')
    .action(async () => {
      // run the generate:entries command
      await generateLibEntries()
    })

  artisan
    .command('generate:vue-compatibility', 'Generate Vue 2 & 3 compatibility')
    .action(async () => {
      await generateVueCompat()
    })

  artisan
    .command('generate:web-types', 'Generate web-types.json for IDEs')
    .action(async () => {
      await generateWebTypes()
    })

  artisan
    .command('generate:vscode-custom-data', 'Generate custom-elements.json for IDEs')
    .action(async () => {
      await generateVsCodeCustomData()
    })

  artisan
    .command('generate:ide-helpers', 'Generate IDE helpers')
    .action(async () => {
      await generateIdeHelpers()
    })
}

export { generateCommands }
