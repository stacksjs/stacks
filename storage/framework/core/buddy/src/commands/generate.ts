import type { ImageTarget } from '@stacksjs/image'
import type { CLI, GeneratorOptions } from '@stacksjs/types'
import process from 'node:process'
import {
  generateComponentMeta,
  generateCoreSymlink,
  generateIdeHelpers,
  generateLibEntries,
  generateOpenApiSpec,
  generatePantryConfig,
  generateProjectImages,
  generateTypes,
  generateVsCodeCustomData,
  generateWebTypes,
  invoke as startGenerationProcess,
  watchTypes,
} from '@stacksjs/actions'
import { intro, log, onUnknownSubcommand, outro } from "@stacksjs/cli"
import { frameworkPath, projectPath } from '@stacksjs/path'
import { ExitCode } from '@stacksjs/types'
import { reportFailure, resultFailed } from '../result'

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
    pantry: 'Generate the pantry configuration file',
    openApi: 'Generate the OpenAPI specification',
    images: 'Generate every image declared in config/images.ts',
    og: 'Generate the social cards used by link previews',
    appStore: 'Generate the App Store screenshot set',
    appIcons: 'Generate the app icon and favicon sets',
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
    .option('-p, --pantry', descriptions.pantry)
    .option('-o, --openapi', descriptions.openApi)
    .option('--images', descriptions.images)
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
    .option('-w, --watch', 'Re-run on changes to models/ and config/', { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .alias('types:generate')
    .action(async (options: GeneratorOptions & { watch?: boolean }) => {
      log.debug('Running `buddy generate:types` ...', options)
      await generateTypes(options)
      // Also refresh database/types.d.ts so userland's
      // `db.selectFrom(...)` keeps getting table-name autocomplete
      // (stacksjs/stacks#1923). Failure is non-fatal — the main
      // type-gen succeeded, and the augmentation file is purely
      // additive (its absence falls back to the `(string & {})`
      // branch in `DatabaseSchema`).
      try {
        const { buildDatabaseSchema } = await import('@stacksjs/orm')
        await buildDatabaseSchema()
      }
      catch (err) {
        log.warn(`[generate:db-types] skipped: ${(err as Error).message}`)
      }
      if (options.watch) {
        await watchTypes(options)
      }
    })

  // `./buddy generate:db-types` — scoped subcommand so users (and CI)
  // can refresh the schema augmentation independently of the broader
  // type-gen pipeline (stacksjs/stacks#1923).
  buddy
    .command('generate:db-types', 'Refresh database/types.d.ts for db.selectFrom autocomplete (stacksjs/stacks#1923)')
    .option('--dry-run', 'Print the would-be file content without writing', { default: false })
    .option('--framework', 'Write the framework\'s own FrameworkSchema instead of the app\'s DatabaseSchema', { default: false })
    .action(async (options: { dryRun?: boolean, framework?: boolean }) => {
      const { buildDatabaseSchema } = await import('@stacksjs/orm')

      /*
       * `--framework` existed in `framework-schema.ts`'s "AUTO-GENERATED by"
       * header but nowhere in the CLI, so the one command documented as the way
       * to refresh that file rejected the flag and the file could not be
       * regenerated at all. It had drifted 20 tables behind the migration
       * corpus (stacksjs/stacks#2409).
       */
      const result = await buildDatabaseSchema(options.framework
        ? {
            dryRun: options.dryRun,
            target: 'framework',
            outFile: frameworkPath('core/database/src/framework-schema.ts'),
            // The corpus lives beside the APP's schema, not beside this out
            // file - `core/database/src/migrations` does not exist.
            migrationsDir: projectPath('database/migrations'),
          }
        : { dryRun: options.dryRun })

      if (options.dryRun) console.log(result.content)
      for (const e of result.errors)
        log.warn(`[generate:db-types] ${e.file}: ${e.error}`)
      log.info(`[generate:db-types] resolved ${result.tables.length} table(s)`)
    })

  // `./buddy generate:vschema` — derive a Vitess keyspace VSchema from the
  // models. Emitted rather than hand-written because the interesting part
  // (which tables co-locate on a shard) is a fact about the relationship
  // graph the models already declare, and getting it wrong is invisible:
  // the cluster still answers, it just scatters every join.
  buddy
    .command('generate:vschema', 'Derive a Vitess VSchema from your models (writes database/vschema.json)')
    .option('--dry-run', 'Print the VSchema without writing it', { default: false })
    .option('--out [path]', 'Where to write the VSchema', { default: 'database/vschema.json' })
    .action(async (options: { dryRun?: boolean, out?: string }) => {
      const { generateVSchema } = await import('@stacksjs/actions')
      const result = await generateVSchema({ dryRun: options.dryRun, out: options.out })

      if (!result.ok) {
        console.error(`\n❌ ${result.error}\n`)
        process.exit(ExitCode.FatalError)
      }

      // The report, not just the file: a generated topology the user cannot
      // see is one they cannot challenge, and the co-location choices are
      // exactly what they should be reviewing.
      console.log(result.report)

      if (options.dryRun)
        console.log(JSON.stringify(result.vschema, null, 2))
      else
        log.success(`Wrote ${result.path} (${result.tableCount} tables)`)
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
      await generateWebTypes()
    })

  buddy
    .command('generate:vscode-custom-data', descriptions.customData)
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: GeneratorOptions) => {
      log.debug('Running `buddy generate:vscode-custom-data` ...', options)
      // `generateVsCodeCustomData` takes no arguments; the options passed here
      // were silently dropped.
      await generateVsCodeCustomData()
    })

  buddy
    .command('generate:ide-helpers', descriptions.ideHelpers)
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: GeneratorOptions) => {
      log.debug('Running `buddy generate:ide-helpers` ...', options)
      await generateIdeHelpers()
    })

  buddy
    .command('generate:component-meta', descriptions.componentMeta)
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: GeneratorOptions) => {
      log.debug('Running `buddy generate:component-meta` ...', options)
      await (generateComponentMeta)()
    })

  buddy
    .command('generate:pantry-config', descriptions.pantry)
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: GeneratorOptions) => {
      log.debug('Running `buddy generate:pantry-config` ...', options)
      await generatePantryConfig()
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

      await outro('Generated OpenAPI specification', {
        startTime: perf,
        useSeconds: true,
      })
    })

  buddy.command('generate:migrations', 'Generate Migrations').action(async (options: GeneratorOptions) => {
    log.debug('Running `buddy generate:migrations` ...', options)
    const { generateMigrations } = await import('@stacksjs/database')
    const result = await generateMigrations()

    // The message, not a summary of it, and written synchronously. A generator
    // refuses for reasons the author can act on - a dialect mismatch, a model
    // that would drop a framework table's columns - and each one names the fix.
    // Logging `'generateMigrations failed'` with the error as a second argument
    // threw all of that away; logging it properly then losing it to the exit
    // before the logger flushed threw it away again.
    if (resultFailed(result))
      reportFailure(result, 'generateMigrations failed')
  })

  buddy
    .command('generate:core-symlink', 'Symlink `.framework` -> storage/framework. A shortcut for core developers.')
    .action(async (options: GeneratorOptions) => {
      log.debug('Running `buddy core-symlink` ...', options)
      await generateCoreSymlink()
    })

  // Generated imagery — social cards, App Store screenshots, app icons — from
  // `config/images.ts`. One command builds everything declared; the scoped
  // aliases exist because a site rebuild wants the cards and nothing else,
  // while a store submission wants the screenshots and nothing else.
  buddy
    .command('generate:images', descriptions.images)
    .alias('images:generate')
    .option('--social', 'Only build the social cards')
    .option('--app-store', 'Only build the App Store screenshots')
    .option('--app-icons', 'Only build the app icons and favicons')
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: GeneratorOptions & { social?: boolean, appStore?: boolean, appIcons?: boolean }) => {
      log.debug('Running `buddy generate:images` ...', options)
      const perf = await intro('buddy generate:images')

      const only: ImageTarget[] = []
      if (options.social) only.push('social')
      if (options.appStore) only.push('app-store')
      if (options.appIcons) only.push('app-icons')

      await generateProjectImages({ only, verbose: options.verbose })

      await outro('Generated images', { startTime: perf, useSeconds: true })
    })

  buddy
    .command('generate:og', descriptions.og)
    .alias('generate:social')
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: GeneratorOptions) => {
      log.debug('Running `buddy generate:og` ...', options)
      const perf = await intro('buddy generate:og')
      await generateProjectImages({ only: ['social'], verbose: options.verbose })
      await outro('Generated social cards', { startTime: perf, useSeconds: true })
    })

  buddy
    .command('generate:app-store', descriptions.appStore)
    .alias('generate:screenshots')
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: GeneratorOptions) => {
      log.debug('Running `buddy generate:app-store` ...', options)
      const perf = await intro('buddy generate:app-store')
      await generateProjectImages({ only: ['app-store'], verbose: options.verbose })
      await outro('Generated App Store screenshots', { startTime: perf, useSeconds: true })
    })

  buddy
    .command('generate:app-icons', descriptions.appIcons)
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: GeneratorOptions) => {
      log.debug('Running `buddy generate:app-icons` ...', options)
      const perf = await intro('buddy generate:app-icons')
      await generateProjectImages({ only: ['app-icons'], verbose: options.verbose })
      await outro('Generated app icons', { startTime: perf, useSeconds: true })
    })

  onUnknownSubcommand(buddy, "generate")
}

// function hasNoOptions(options: GeneratorOptions) {
//   return !options.types && !options.entries && !options.webTypes && !options.customData && !options.ideHelpers && !options.componentMeta
// }
