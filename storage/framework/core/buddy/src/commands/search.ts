import type { CLI, SearchCommandOptions } from '@stacksjs/types'
import process from 'node:process'
import { runAction } from '@stacksjs/actions'
import { intro, log, outro } from '@stacksjs/cli'
import { Action } from '@stacksjs/enums'
import { ExitCode } from '@stacksjs/types'

export function search(buddy: CLI): void {
  const descriptions = {
    import: 'Indexes database data to search engine',
    flush: 'Flushes all data from search engine',
    settings: 'Update index settings',
    list: 'List index settings',
    model: 'Target a specific model',
    project: 'Target a specific project',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('search-engine:update', descriptions.import)
    .option('-m, --model [model]', descriptions.model, { default: '' })
    .option('-f, --flush [flush]', descriptions.flush, { default: false })
    .option('-s, --settings [settings]', descriptions.settings, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .option('-p, --project [project]', descriptions.project, { default: false })
    .action(async (options: SearchCommandOptions) => {
      log.debug('Running `search-engine:update` ...', options)

      let actionString = Action.SearchEngineImport
      let introString = 'search-engine:update'

      if (options.model) {
        actionString = Action.SearchEngineImport
        introString = `search-engine:update --model ${options.model}`
      }

      if (options.settings) {
        actionString = Action.SearchEnginePushSettings
        introString = `search-engine:update --settings`
      }

      if (options.flush) {
        actionString = Action.SearchEngineFlush
        introString = `search-engine:update --flush`
      }

      const perf = await intro(introString)
      const result = await runAction(actionString, options)

      if (result.isErr()) {
        await outro(
          'While running the stripe:setup command, there was an issue',
          { startTime: perf, useSeconds: true },
          result.error,
        )
        process.exit()
      }

      await outro(`Successfully imported model data to search engine.`, {
        startTime: perf,
        useSeconds: true,
      })

      // process.exit(ExitCode.Success)
    })

  buddy
    .command('search-engine:settings', descriptions.list)
    .option('-m, --model [model]', descriptions.model, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: SearchCommandOptions) => {
      if (!options.model)
        log.error('Missing required option --model')

      log.debug('Running `search-engine:settings` ...', options)

      const perf = await intro('search-engine:settings')
      const result = await runAction(Action.SearchEngineListSettings, options)

      if (result.isErr()) {
        await outro(
          'While running the stripe:setup command, there was an issue',
          { startTime: perf, useSeconds: true },
          result.error,
        )
        process.exit()
      }

      await outro(`Successfully listed search engine index settings.`, {
        startTime: perf,
        useSeconds: true,
      })

      process.exit(ExitCode.Success)
    })
}
