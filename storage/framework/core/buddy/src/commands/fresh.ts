import type { CLI, FreshOptions } from '@stacksjs/types'
import process from 'node:process'
import { runAction } from '@stacksjs/actions'
import { intro, log, outro } from '@stacksjs/cli'
import { Action } from '@stacksjs/enums'
import { ExitCode } from '@stacksjs/types'

export function fresh(buddy: CLI): void {
  const descriptions = {
    fresh: 'Re-installs your npm dependencies',
    project: 'Target a specific project',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('fresh', descriptions.fresh)
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: FreshOptions) => {
      log.debug('Running `buddy fresh` ...', options)

      const perf = await intro('buddy fresh')
      const result = await runAction(Action.Fresh, {
        ...options,
        stdout: 'inherit',
      })

      if (result.isErr()) {
        await outro(
          'While running `buddy fresh`, there was an issue',
          { startTime: perf, useSeconds: true },
          result.error,
        )
        process.exit(ExitCode.FatalError)
      }

      await outro('Freshly reinstalled your dependencies', {
        startTime: perf,
        useSeconds: true,
      })
      process.exit(ExitCode.Success)
    })

  buddy.on('fresh:*', () => {
    console.error('Invalid command: %s\nSee --help for a list of available commands.', buddy.args.join(' '))
    process.exit(1)
  })
}
