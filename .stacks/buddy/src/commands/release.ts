import type { CLI, ReleaseOptions } from '@stacksjs/types'
import { intro, log, outro } from '@stacksjs/cli'
import { runAction } from '@stacksjs/actions'
import { Action } from '@stacksjs/types'

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
      const result = await runAction(Action.Release, options)

      // console.log('result', result)

      // check if any element of the array is an error
      if (Array.isArray(result) && result.some(r => r.isErr())) {
        log.error('Failed to trigger the CI/CD release workflow.', result)
        process.exit()
      }

      if (result.isErr()) {
        log.error('Failed to trigger the CI/CD release workflow.', result.error)
        process.exit()
      }

      outro('Triggered CI/CD release workflow', { startTime, useSeconds: true })
    })
}

export { release }
