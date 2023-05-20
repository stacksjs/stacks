import type { CLI, FreshOptions } from '@stacksjs/types'
import { runAction } from '@stacksjs/actions'
import { intro, outro } from '@stacksjs/cli'
import { Action, ExitCode } from '@stacksjs/types'

async function changelog(buddy: CLI) {
  const descriptions = {
    changelog: 'Create a CHANGELOG.md file',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('changelog', descriptions.changelog)
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: FreshOptions) => {
      const perf = await intro('buddy changelog')
      const result = await runAction(Action.Changelog, options)

      if (result.isErr()) {
        outro('While running the changelog command, there was an issue', { startTime: perf, useSeconds: true, isError: true }, result.error as Error)
        process.exit()
      }

      outro('Generated the CHANGELOG.md file.', { startTime: perf, useSeconds: true })
      process.exit(ExitCode.Success)
    })
}

export { changelog }
