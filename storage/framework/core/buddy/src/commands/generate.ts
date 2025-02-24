import type { CLI, GeneratorOptions } from '@stacksjs/types'
import process from 'node:process'
import {
  generateComponentMeta,
  generateCoreSymlink,
  generateIdeHelpers,
  generateLibEntries,
  generateOpenApiSpec,
  generatePkgxConfig,
  generateTypes,
  generateVsCodeCustomData,
  generateWebTypes,
  invoke as startGenerationProcess,
} from '@stacksjs/actions'
import { intro, log, outro } from '@stacksjs/cli'
import { generateModelFiles } from '@stacksjs/orm'
import { initiateImports } from '@stacksjs/server'
import { ExitCode } from '@stacksjs/types'

export function generate(buddy: CLI): void {
  const descriptions = {
    command:
      'Automagically build any of your libraries/packages for production use. Select any of the following packages',
    types: 'Generate your TypeScript types',
    entries: 'Generate your function & Component Library Entry Points',
    webTypes: 'Generate web-types.json for IDEs',
    customData: 'Generate VS Code custom data (custom-elements.json) for IDEs',
    ideHelpers: 'Generate IDE helpers',
    componentMeta: 'Generate component meta information',
    coreSymlink: 'Generate symlink of the core framework to the project root',
    pkgx: 'Generate the pkgx configuration file',
    modelFiles: 'Generate the model files',
    openApi: 'Generate the OpenAPI specification',
    select: 'What are you trying to generate?',
    project: 'Target a specific project',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('generate', descriptions.command)
    .option('-t, --types', descriptions.types)
    .option('-e, --entries', descriptions.entries)
    .option('-w, --web-types', descriptions.webTypes)
    .option('-c, --custom-data', descriptions.customData)
    .option('-i, --ide-helpers', descriptions.ideHelpers)
    .option('-c, --component-meta', descriptions.componentMeta)
    .option('-p, --pkgx', descriptions.pkgx)
    .option('-m, --model-files', descriptions.modelFiles)
    .option('-o, --openapi', descriptions.openApi)
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--core-symlink', descriptions.coreSymlink)
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: GeneratorOptions) => {
      log.debug('Running `buddy generate` ...', options)

      // TODO: uncomment this
      // if (hasNoOptions(options)) {
      //   let answers = await prompt.require()
      //     .multiselect(descriptions.select, {
      //       options: [
      //         { label: '1.) TypeScript Types', value: 'types' },
      //         { label: '2.) Library Entry Points', value: 'entries' },
      //         { label: '3.) Web Types', value: 'web-types' },
      //         { label: '4.) VS Code Custom Data', value: 'custom-data' },
      //         { label: '5.) IDE Helpers', value: 'ide-helpers' },
      //         { label: '6.) Component Meta', value: 'component-meta' },
      //       ],
      //     })
      //
      //   if (isString(answers))
      //     answers = [answers]
      //
      //   // creates an object out of array and sets answers to true
      //   options = (answers as Array<any>).reduce((a: any, v: any) => ({ ...a, [v]: true }), {})
      // }

      await startGenerationProcess(options)

      process.exit(ExitCode.Success)
    })

  buddy
    .command('generate:types', descriptions.types)
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .alias('types:generate')
    .action(async (options: GeneratorOptions) => {
      log.debug('Running `buddy generate:types` ...', options)
      await generateTypes(options)
    })

  buddy
    .command('generate:entries', descriptions.entries)
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: GeneratorOptions) => {
      log.debug('Running `buddy generate:entries` ...', options)
      await generateLibEntries(options)
    })

  buddy
    .command('generate:web-types', descriptions.webTypes)
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: GeneratorOptions) => {
      log.debug('Running `buddy generate:web-types` ...', options)
      await generateWebTypes(options)
    })

  buddy
    .command('generate:vscode-custom-data', descriptions.customData)
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: GeneratorOptions) => {
      log.debug('Running `buddy generate:vscode-custom-data` ...', options)
      await generateVsCodeCustomData(options)
    })

  buddy
    .command('generate:ide-helpers', descriptions.ideHelpers)
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: GeneratorOptions) => {
      log.debug('Running `buddy generate:ide-helpers` ...', options)
      await generateIdeHelpers(options)
    })

  buddy
    .command('generate:component-meta', descriptions.componentMeta)
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: GeneratorOptions) => {
      log.debug('Running `buddy generate:component-meta` ...', options)
      await generateComponentMeta()
    })

  buddy
    .command('generate:pkgx-config', descriptions.pkgx)
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action((options: GeneratorOptions) => {
      log.debug('Running `buddy generate:pkgx-config` ...', options)
      generatePkgxConfig()
    })

  buddy
    .command('generate:model-files', descriptions.modelFiles)
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async () => {
      const perf = await intro('buddy generate:model-files')

      try {
        await generateModelFiles()

        await initiateImports()

        outro('Generated Model files', {
          startTime: perf,
          useSeconds: true,
        })
      }
      catch (error) {
        log.error('There was an error generating your model files', error)
        process.exit(ExitCode.FatalError)
      }
    })

  buddy
    .command('generate:openapi-spec', descriptions.openApi)
    .alias('generate:openapi')
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: GeneratorOptions) => {
      log.debug('Running `buddy generate:openapi-spec` ...', options)
      const perf = await intro('buddy generate:openapi-spec')

      await generateOpenApiSpec()

      outro('Generated OpenAPI specification', {
        startTime: perf,
        useSeconds: true,
      })
    })

  buddy.command('generate:migrations', 'Generate Migrations').action((options: GeneratorOptions) => {
    log.debug('Running `buddy generate:migrations` ...', options)
    // generateMigrations()
  })

  buddy
    .command('generate:core-symlink', 'Generate core symlink. A shortcut for core developers.')
    .action(async (options: GeneratorOptions) => {
      log.debug('Running `buddy core-symlink` ...', options)
      await generateCoreSymlink()
    })

  buddy.on('generate:*', () => {
    console.error('Invalid command: %s\nSee --help for a list of available commands.', buddy.args.join(' '))
    process.exit(1)
  })
}

// function hasNoOptions(options: GeneratorOptions) {
//   return !options.types && !options.entries && !options.webTypes && !options.customData && !options.ideHelpers && !options.componentMeta
// }
