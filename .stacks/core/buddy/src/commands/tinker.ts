import process from 'node:process'
import { type CLI, type TinkerOptions } from '@stacksjs/types'
import { runAction } from '@stacksjs/actions'
import { intro, outro } from '@stacksjs/cli'
import { Action, ExitCode } from '@stacksjs/types'

export function tinker(buddy: CLI) {
  const descriptions = {
    tinker: 'Tinker with your code',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('tinker', descriptions.tinker)
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: TinkerOptions) => {
      const perf = await intro('buddy tinker')
      const result = runAction(Action.Tinker, options)

      if (result.isErr()) {
        await outro('While running the tinker command, there was an issue', { startTime: perf, useSeconds: true, isError: true }, result.error || undefined)
        process.exit()
      }

      await outro('Tinker mode exited.', { startTime: perf, useSeconds: true })
      process.exit(ExitCode.Success)
    })
}
