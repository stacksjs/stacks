import type { CLI, SearchOptions } from '@stacksjs/types'
import process from 'node:process'
import { runAction } from '@stacksjs/actions'
import { intro, log, outro } from '@stacksjs/cli'
import { Action } from '@stacksjs/enums'
import { ExitCode } from '@stacksjs/types'

export function search(buddy: CLI): void {
  const descriptions = {
    search: 'Indexes database data to search engine',
    model: 'Target a specific model',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('search-engine:update', descriptions.search)
    .option('-m, --model [model]', descriptions.model, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: SearchOptions) => {
      log.debug('Running `search-engine:update` ...', options)

      const perf = await intro('search-engine:update')
      const result = await runAction(Action.SearchEngineUpdate, options)

      if (result.isErr()) {
        await outro(
          'While running the stripe:setup command, there was an issue',
          { startTime: perf, useSeconds: true },
          result.error,
        )
        process.exit()
      }

      await outro(`Stripe products created successfully`, {
        startTime: perf,
        useSeconds: true,
      })

      process.exit(ExitCode.Success)
    })
}
