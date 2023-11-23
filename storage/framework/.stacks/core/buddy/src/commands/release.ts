import process from 'node:process'
import { Action } from '@stacksjs/enums'
import { ExitCode } from '@stacksjs/types'
import type { CLI, ReleaseOptions } from '@stacksjs/types'
import { intro, log, outro } from '@stacksjs/cli'
import { runAction } from '@stacksjs/actions'

const descriptions = {
  release: 'Release a new version of your libraries/packages',
  verbose: 'Enable verbose output',
}

export function release(buddy: CLI) {
  buddy
    .command('release', descriptions.release)
    .option('--verbose', descriptions.verbose, { default: true }) // it's on by default because it requires manual input
    .action(async (options: ReleaseOptions) => {
      const startTime = await intro('buddy release')
      const result = await runAction(Action.Release, options)

      if (result.isErr()) {
        log.error('Failed to release', result.error)
        process.exit(ExitCode.FatalError)
      }

      await outro('Triggered your CI/CD release workflow', { startTime, useSeconds: true })
    })

  buddy.on('release:*', () => {
    console.error('Invalid command: %s\nSee --help for a list of available commands.', buddy.args.join(' '))
    process.exit(1)
  })
}
