import type { CAC } from 'cac'
import { generateComponentMeta, generateIdeHelpers, generateLibEntries, generateVsCodeCustomData, generateVueCompat, generateWebTypes, startGenerationProcess } from './actions/generate'
import { generateTypes } from './actions/types'

async function generate(stacks: CAC) {
  stacks
    .command('generate', 'Automagically build any of your libraries/packages for production use. Select any of the following packages')
    .option('-t, --types', 'Generate your TypeScript types')
    .option('-e, --entries', 'Generate your function & component library entry points')
    .option('-w, --web-types', 'Generate web-types.json for IDEs')
    .option('-c, --custom-data', 'Generate VS Code custom data (custom-elements.json) for IDEs')
    .option('-i, --ide-helpers', 'Generate IDE helpers')
    .option('-v, --vue-compatibility', 'Generate Vue 2 & 3 compatibility')
    .option('-c, --component-meta', 'Generate component meta information')
    .option('--debug', 'Add additional debug logs', { default: false })
    .action(async (options: any) => {
      await startGenerationProcess(options)
    })

  stacks
    .command('generate:types', 'Generate the types of & for your library/libraries')
    .action(async () => {
      await generateTypes()
    })

  stacks
    .command('generate:entries', 'Generate the entry points for your libraries')
    .action(async () => {
      // run the generate:entries command
      await generateLibEntries()
    })

  stacks
    .command('generate:vue-compatibility', 'Generate Vue 2 & 3 compatibility')
    .action(async () => {
      await generateVueCompat()
    })

  stacks
    .command('generate:web-types', 'Generate web-types.json for IDEs')
    .action(async () => {
      await generateWebTypes()
    })

  stacks
    .command('generate:vscode-custom-data', 'Generate VS Code custom data (custom-elements.json) for IDEs')
    .action(async () => {
      await generateVsCodeCustomData()
    })

  stacks
    .command('generate:ide-helpers', 'Generate IDE helpers')
    .action(async () => {
      await generateIdeHelpers()
    })

  stacks
    .command('generate:component-meta', 'Generate component meta information')
    .action(async () => {
      await generateComponentMeta()
    })
}

export { generate }
