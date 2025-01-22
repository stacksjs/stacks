import type { CLI, CliQueueOptions } from '@stacksjs/types'
import process from 'node:process'
import { runAction } from '@stacksjs/actions'
import { intro, log, outro } from '@stacksjs/cli'
import { Action } from '@stacksjs/enums'
import { ExitCode } from '@stacksjs/types'

export function queue(buddy: CLI): void {
  const descriptions = {
    project: 'Target a specific project',
    queue: 'Run a specific queue',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('queue:work', descriptions.queue)
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('-q, --queue [queue]', descriptions.queue, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: CliQueueOptions) => {
      log.debug('Running `buddy queue:work` ...', options)

      const perf = await intro('buddy queue:work')
      const result = await runAction(Action.QueueWork, options)

      if (result.isErr()) {
        await outro(
          'While running the queue:work command, there was an issue',
          { startTime: perf, useSeconds: true },
          result.error,
        )
        process.exit()
      }

      process.exit(ExitCode.Success)
    })
}
