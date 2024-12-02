import type { CLI, SearchOptions } from '@stacksjs/types'
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
    verbose: 'Enable verbose output',
  }

  buddy
    .command('search-engine:import', descriptions.import)
    .option('-m, --model [model]', descriptions.model, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: SearchOptions) => {
      log.debug('Running `search-engine:import` ...', options)

      const perf = await intro('search-engine:import')
      const result = await runAction(Action.SearchEngineImport, options)

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

      process.exit(ExitCode.Success)
    })

  buddy
    .command('search-engine:flush', descriptions.flush)
    .option('-m, --model [model]', descriptions.model, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: SearchOptions) => {
      log.debug('Running `search-engine:flush` ...', options)

      const perf = await intro('search-engine:flush')
      const result = await runAction(Action.SearchEngineFlush, options)

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

      process.exit(ExitCode.Success)
    })

  buddy
    .command('search-engine:index-settings-push', descriptions.settings)
    .option('-m, --model [model]', descriptions.model, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: SearchOptions) => {
      log.debug('Running `ssearch-engine:index-settings-push` ...', options)

      const perf = await intro('ssearch-engine:index-settings-push')
      const result = await runAction(Action.SearchEnginePushSettings, options)

      if (result.isErr()) {
        await outro(
          'While running the stripe:setup command, there was an issue',
          { startTime: perf, useSeconds: true },
          result.error,
        )
        process.exit()
      }

      await outro(`Successfully updated search engine index settings.`, {
        startTime: perf,
        useSeconds: true,
      })

      process.exit(ExitCode.Success)
    })

    buddy
    .command('search-engine:index-setting-list', descriptions.list)
    .option('-m, --model [model]', descriptions.model, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: SearchOptions) => {
      log.debug('Running `search-engine:sync-list` ...', options)

      const perf = await intro('search-engine:index-setting-list')
      const result = await runAction(Action.SearchEngineListSettings, options)

      if (result.isErr()) {
        await outro(
          'While running the stripe:setup command, there was an issue',
          { startTime: perf, useSeconds: true },
          result.error,
        )
        process.exit()
      }

      await outro(`Successfully updated search engine index settings.`, {
        startTime: perf,
        useSeconds: true,
      })

      process.exit(ExitCode.Success)
    })
}
