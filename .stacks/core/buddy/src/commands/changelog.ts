import process from 'node:process'
import { type CLI, type FreshOptions } from '@stacksjs/types'
import { runAction } from '@stacksjs/actions'
import { intro, outro } from '@stacksjs/cli'
import { Action, ExitCode } from '@stacksjs/types'

export function changelog(buddy: CLI) {
  const descriptions = {
    changelog: 'Create a CHANGELOG.md file',
    quiet: 'Minimal output',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('changelog', descriptions.changelog)
    .option('--quiet', descriptions.quiet, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: FreshOptions) => {
      const perf = await intro('buddy changelog')
      const result = runAction(Action.Changelog, options)

      if (result.isErr()) {
        await outro('While running the changelog command, there was an issue', { ...options, startTime: perf, useSeconds: true, isError: true }, result.error as Error)
        process.exit()
      }

      await outro('Generated the CHANGELOG.md file', { ...options, startTime: perf, useSeconds: true, type: 'info' })
      process.exit(ExitCode.Success)
    })
}
