import type { CleanOptions, CLI } from '@stacksjs/types'
import process from 'node:process'
import { runAction } from '@stacksjs/actions'
import { intro, log, outro } from '@stacksjs/cli'
import { Action } from '@stacksjs/enums'
import { ExitCode } from '@stacksjs/types'

export function clean(buddy: CLI): void {
  const descriptions = {
    clean: 'Removes all node_modules & lock files',
    project: 'Target a specific project',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('clean', descriptions.clean)
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: CleanOptions) => {
      log.debug('Running `buddy clean` ...', options)

      const perf = await intro('buddy clean')
      const result = await runAction(Action.Clean, options)

      if (result.isErr()) {
        await outro(
          'While running the clean command, there was an issue',
          { startTime: perf, useSeconds: true },
          result.error,
        )
        process.exit(ExitCode.FatalError)
      }

      await outro('Cleaned up', {
        startTime: perf,
        useSeconds: true,
        message: 'Cleaned up',
      })
      process.exit(ExitCode.Success)
    })

  buddy.on('clean:*', () => {
    console.error('Invalid command: %s\nSee --help for a list of available commands.', buddy.args.join(' '))
    process.exit(1)
  })
}
