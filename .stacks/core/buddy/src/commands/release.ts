import { Action } from '@stacksjs/types'
import type { CLI, ReleaseOptions } from '@stacksjs/types'
import { intro, log, outro } from '@stacksjs/cli'
import { runAction } from '@stacksjs/actions'

const descriptions = {
  release: 'Release a new version of your libraries/packages',
  verbose: 'Enable verbose output',
}

async function release(buddy: CLI) {
  buddy
    .command('release', descriptions.release)
    .option('--verbose', descriptions.verbose, { default: true }) // it's on by default because it requires manual input
    .action(async (options: ReleaseOptions) => {
      const startTime = await intro('buddy release')
      const result = await runAction(Action.Release, { ...options, shell: true })

      if (result.isErr()) {
        log.error('Failed to release', result.error)
        process.exit()
      }

      outro('Triggered your CI/CD release workflow', { startTime, useSeconds: true })
    })
}

export { release }
