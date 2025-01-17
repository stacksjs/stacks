import type { CLI, ScheduleOptions } from '@stacksjs/types'
import process from 'node:process'
import { runAction } from '@stacksjs/actions'
import { intro, log, outro } from '@stacksjs/cli'
import { Action } from '@stacksjs/enums'
import { ExitCode } from '@stacksjs/types'

export function schedule(buddy: CLI): void {
  const descriptions = {
    project: 'Target a specific project',
    schedule: 'Run the scheduler',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('schedule:run', descriptions.schedule)
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: ScheduleOptions) => {
      log.debug('Running `buddy schedule:run` ...', options)

      const perf = await intro('buddy schedule:run')
      const result = await runAction(Action.ScheduleRun, options)

      if (result.isErr()) {
        await outro(
          'While running the schedule:run command, there was an issue',
          { startTime: perf, useSeconds: true },
          result.error,
        )
        process.exit()
      }

      process.exit(ExitCode.Success)
    })
}
