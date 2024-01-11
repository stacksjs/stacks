import process from 'node:process'
import { ExitCode } from '@stacksjs/types'
import type { CLI, CleanOptions } from '@stacksjs/types'
import { runAction } from '@stacksjs/actions'
import { intro, outro } from '@stacksjs/cli'
import { Action } from '@stacksjs/enums'

export function clean(buddy: CLI) {
  const descriptions = {
    clean: 'Removes all node_modules & lock files',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('clean', descriptions.clean)
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: CleanOptions) => {
      const perf = await intro('buddy clean')
      const result = await runAction(Action.Clean, options)

      if (result.isErr()) {
        await outro('While running the clean command, there was an issue', { startTime: perf, useSeconds: true }, result.error)
        process.exit(ExitCode.FatalError)
      }

      await outro('Cleaned up', { startTime: perf, useSeconds: true, message: 'Cleaned up' })
      process.exit(ExitCode.Success)
    })

  buddy.on('clean:*', () => {
    console.error('Invalid command: %s\nSee --help for a list of available commands.', buddy.args.join(' '))
    process.exit(1)
  })
}
