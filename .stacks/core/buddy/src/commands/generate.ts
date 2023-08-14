/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return */
import process from 'node:process'
import { type CLI, type GeneratorOptions } from '@stacksjs/types'
import { ExitCode } from '@stacksjs/types'
import { prompt } from '@stacksjs/cli'
import { isString } from '@stacksjs/validation'
import {
  generateComponentMeta,
  generateIdeHelpers,
  generateLibEntries,
  generateMigrations,
  generateTeaConfig,
  generateTypes,
  generateVsCodeCustomData,
  generateVueCompat,
  generateWebTypes,
  invoke as startGenerationProcess,
} from '@stacksjs/actions'

export function generate(buddy: CLI) {
  const descriptions = {
    command: 'Automagically build any of your libraries/packages for production use. Select any of the following packages',
    types: 'Generate your TypeScript types',
    entries: 'Generate your function & component library entry points',
    webTypes: 'Generate web-types.json for IDEs',
    customData: 'Generate VS Code custom data (custom-elements.json) for IDEs',
    ideHelpers: 'Generate IDE helpers',
    vueCompat: 'Generate Vue 2 & 3 compatibility',
    componentMeta: 'Generate component meta information',
    tea: 'Generate the Tea configuration file',
    select: 'What are you trying to generate?',
    verbose: 'Enable verbose output',
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
    .option('-tc, --tea-config', descriptions.tea)
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: GeneratorOptions) => {
      if (hasNoOptions(options)) {
        let answers = await prompt.require()
          .multiselect(descriptions.select, {
            options: [
              { label: '1.) TypeScript Types', value: 'types' },
              { label: '2.) Library Entry Points', value: 'entries' },
              { label: '3.) Web Types', value: 'web-types' },
              { label: '4.) VS Code Custom Data', value: 'custom-data' },
              { label: '5.) IDE Helpers', value: 'ide-helpers' },
              { label: '6.) Vue 2 & 3 Compatibility', value: 'vue-compatibility' },
              { label: '7.) Component Meta', value: 'component-meta' },
            ],
          })

        if (isString(answers))
          answers = [answers]

        // creates an object out of array and sets answers to true
        options = (answers as Array<any>).reduce((a: any, v: any) => ({ ...a, [v]: true }), {})
      }

      await startGenerationProcess(options)

      process.exit(ExitCode.Success)
    })

  buddy
    .command('generate:types', descriptions.types)
    .option('--verbose', descriptions.verbose, { default: false })
    .alias('types:generate')
    .action(async (options: GeneratorOptions) => {
      await generateTypes(options)
    })

  buddy
    .command('generate:entries', descriptions.entries)
    .option('--verbose', descriptions.verbose, { default: false })
    .action((options: GeneratorOptions) => {
      generateLibEntries(options)
    })

  buddy
    .command('generate:vue-compatibility', descriptions.vueCompat)
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: GeneratorOptions) => {
      await generateVueCompat(options)
    })

  buddy
    .command('generate:web-types', descriptions.webTypes)
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: GeneratorOptions) => {
      await generateWebTypes(options)
    })

  buddy
    .command('generate:vscode-custom-data', descriptions.customData)
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: GeneratorOptions) => {
      await generateVsCodeCustomData(options)
    })

  buddy
    .command('generate:ide-helpers', descriptions.ideHelpers)
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: GeneratorOptions) => {
      await generateIdeHelpers(options)
    })

  buddy
    .command('generate:component-meta', descriptions.componentMeta)
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: GeneratorOptions) => {
      await generateComponentMeta(options)
    })

  buddy
    .command('generate:tea-config', descriptions.tea)
    .option('--verbose', descriptions.verbose, { default: false })
    .action(() => {
      generateTeaConfig()
    })

  buddy
    .command('generate:migrations', 'Generate Migrations')
    .action(() => {
      generateMigrations()
    })
}

function hasNoOptions(options: GeneratorOptions) {
  return !options.types && !options.entries && !options.webTypes && !options.customData && !options.ideHelpers && !options.vueCompatibility && !options.componentMeta
}
