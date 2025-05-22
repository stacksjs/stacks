import type { CLI } from '@stacksjs/types'
import process from 'node:process'
import { runAction } from '@stacksjs/actions'
import { intro, log, outro } from '@stacksjs/cli'
import { Action } from '@stacksjs/enums'
import { ExitCode } from '@stacksjs/types'

export function auth(buddy: CLI): void {
  const descriptions = {
    token: 'Create a personal access client token',
    project: 'Target a specific project',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('auth:token', descriptions.token)
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options) => {
      log.debug('Running `buddy auth:token` ...', options)

      const perf = await intro('buddy auth:token')
      const result = await runAction(Action.CreatePersonalAccessClient, options)

      if (result.isErr()) {
        await outro(
          'While creating the personal access client token, there was an issue',
          { startTime: perf, useSeconds: true },
          result.error,
        )
        process.exit()
      }

      await outro('Personal access client token created successfully.', {
        startTime: perf,
        useSeconds: true,
      })
      process.exit(ExitCode.Success)
    })
}
