import type { CLI, GeneratorOptions } from '@stacksjs/types'
import { ExitCode } from '@stacksjs/types'
import { prompts } from '@stacksjs/cli'
import { componentMeta, ideHelpers, libEntries, models, invoke as startGenerationProcess, types, vsCodeCustomData, vueCompat, webTypes } from '@stacksjs/actions/generate'

async function generate(buddy: CLI) {
  const descriptions = {
    command: 'Automagically build any of your libraries/packages for production use. Select any of the following packages',
    types: 'Generate your TypeScript types',
    entries: 'Generate your function & component library entry points',
    webTypes: 'Generate web-types.json for IDEs',
    customData: 'Generate VS Code custom data (custom-elements.json) for IDEs',
    ideHelpers: 'Generate IDE helpers',
    vueCompat: 'Generate Vue 2 & 3 compatibility',
    componentMeta: 'Generate component meta information',
    verbose: 'Enable verbose output',
    debug: 'Enable debug mode',
  }

  buddy
    .command('generate', descriptions.command)
    .option('-t, --types', descriptions.types)
    .option('-e, --entries', descriptions.entries)
    .option('-w, --web-types', descriptions.webTypes)
    .option('-c, --custom-data', descriptions.customData)
    .option('-i, --ide-helpers', descriptions.ideHelpers)
    .option('-v, --vue-compatibility', descriptions.vueCompat)
    .option('-c, --component-meta', descriptions.componentMeta)
    .option('--verbose', descriptions.verbose, { default: false })
    .option('--debug', descriptions.debug, { default: false })
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

      process.exit(ExitCode.Success)
    })

  buddy
    .command('generate:types', descriptions.types)
    .option('--verbose', descriptions.verbose, { default: false })
    .option('--debug', descriptions.debug, { default: false })
    .alias('types:generate')
    .action(async (options: GeneratorOptions) => {
      await types(options)
    })

  buddy
    .command('generate:entries', descriptions.entries)
    .option('--verbose', descriptions.verbose, { default: false })
    .option('--debug', descriptions.debug, { default: false })
    .action(async (options: GeneratorOptions) => {
      await libEntries(options)
    })

  buddy
    .command('generate:vue-compatibility', descriptions.vueCompat)
    .option('--verbose', descriptions.verbose, { default: false })
    .option('--debug', descriptions.debug, { default: false })
    .action(async (options: GeneratorOptions) => {
      await vueCompat(options)
    })

  buddy
    .command('generate:web-types', descriptions.webTypes)
    .option('--verbose', descriptions.verbose, { default: false })
    .option('--debug', descriptions.debug, { default: false })
    .action(async (options: GeneratorOptions) => {
      await webTypes(options)
    })

  buddy
    .command('generate:vscode-custom-data', descriptions.customData)
    .option('--verbose', descriptions.verbose, { default: false })
    .option('--debug', descriptions.debug, { default: false })
    .action(async (options: GeneratorOptions) => {
      await vsCodeCustomData(options)
    })

  buddy
    .command('generate:ide-helpers', descriptions.ideHelpers)
    .option('--verbose', descriptions.verbose, { default: false })
    .option('--debug', descriptions.debug, { default: false })
    .action(async (options: GeneratorOptions) => {
      await ideHelpers(options)
    })

  buddy
    .command('generate:component-meta', descriptions.componentMeta)
    .option('--verbose', descriptions.verbose, { default: false })
    .option('--debug', descriptions.debug, { default: false })
    .action(async (options: GeneratorOptions) => {
      await componentMeta(options)
    })

  buddy
    .command('generate:migrations', 'Generate Migrations')
    .action(async () => {
      await models()
    })
}

function hasNoOptions(options: GeneratorOptions) {
  return !options.types && !options.entries && !options.webTypes && !options.customData && !options.ideHelpers && !options.vueCompatibility && !options.componentMeta
}

export { generate }
