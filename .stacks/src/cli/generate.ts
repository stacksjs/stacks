import type { CLI, GeneratorOptions } from '@stacksjs/types'
import { Prompts } from '@stacksjs/cli'
import { generateComponentMeta, generateIdeHelpers, generateLibEntries, generateVsCodeCustomData, generateVueCompat, generateWebTypes, startGenerationProcess } from './actions/generate'
import { generateTypes } from './actions/types'

const { prompts } = Prompts

async function generate(stacks: CLI) {
  stacks
    .command('generate', 'Automagically build any of your libraries/packages for production use. Select any of the following packages')
    .option('-t, --types', 'Generate your TypeScript types')
    .option('-e, --entries', 'Generate your function & component library entry points')
    .option('-w, --web-types', 'Generate web-types.json for IDEs')
    .option('-c, --custom-data', 'Generate VS Code custom data (custom-elements.json) for IDEs')
    .option('-i, --ide-helpers', 'Generate IDE helpers')
    .option('-v, --vue-compatibility', 'Generate Vue 2 & 3 compatibility')
    .option('-c, --component-meta', 'Generate component meta information')
    .option('--debug', 'Add additional debug logging', { default: false })
    .action(async (options: GeneratorOptions) => {
      if (hasNoOptions(options)) {
        const answers = await prompts.multiselect({
          type: 'multiselect',
          name: 'generate',
          message: 'What are you trying to generate?',
          choices: [ // todo: should be a multi-select
            { title: '1.) TypeScript Types', value: 'types' },
            { title: '2.) Library Entry Points', value: 'entries' },
            { title: '3.) Web Types', value: 'web-types' },
            { title: '4.) VS Code Custom Data', value: 'custom-data' },
            { title: '5.) IDE Helpers', value: 'ide-helpers' },
            { title: '6.) Vue 2 & 3 Compatibility', value: 'vue-compatibility' },
            { title: '7.) Component Meta', value: 'component-meta' },
          ],
        })

        // creates an object out of array and sets answers to true
        options = answers.reduce((a: any, v: any) => ({ ...a, [v]: true }), {})
      }

      await startGenerationProcess(options)
    })

  stacks
    .command('generate:types', 'Generate the types of & for your library/libraries')
    .option('--debug', 'Add additional debug logging', { default: false })
    .action(async (options: GeneratorOptions) => {
      await generateTypes(options)
    })

  stacks
    .command('generate:entries', 'Generate the entry points for your libraries')
    .option('--debug', 'Add additional debug logging', { default: false })
    .action(async (options: GeneratorOptions) => {
      await generateLibEntries(options)
    })

  stacks
    .command('generate:vue-compatibility', 'Generate Vue 2 & 3 compatibility')
    .option('--debug', 'Add additional debug logging', { default: false })
    .action(async (options: GeneratorOptions) => {
      await generateVueCompat(options)
    })

  stacks
    .command('generate:web-types', 'Generate web-types.json for IDEs')
    .option('--debug', 'Add additional debug logging', { default: false })
    .action(async (options: GeneratorOptions) => {
      await generateWebTypes(options)
    })

  stacks
    .command('generate:vscode-custom-data', 'Generate VS Code custom data (custom-elements.json) for IDEs')
    .option('--debug', 'Add additional debug logging', { default: false })
    .action(async (options: GeneratorOptions) => {
      await generateVsCodeCustomData(options)
    })

  stacks
    .command('generate:ide-helpers', 'Generate IDE helpers')
    .option('--debug', 'Add additional debug logging', { default: false })
    .action(async (options: GeneratorOptions) => {
      await generateIdeHelpers(options)
    })

  stacks
    .command('generate:component-meta', 'Generate component meta information')
    .option('--debug', 'Add additional debug logging', { default: false })
    .action(async (options: GeneratorOptions) => {
      await generateComponentMeta(options)
    })
}

function hasNoOptions(options: GeneratorOptions) {
  return !options.types && !options.entries && !options.webTypes && !options.customData && !options.ideHelpers && !options.vueCompatibility && !options.componentMeta
}

export { generate }
