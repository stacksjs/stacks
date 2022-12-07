import type { CLI, ReleaseOptions } from '@stacksjs/types'
import { intro, log, outro } from '@stacksjs/cli'
import { runAction } from '@stacksjs/actions'
import { Action } from '@stacksjs/types'

const descriptions = {
  release: 'Release a new version of your libraries/packages',
  debug: 'Enable debug mode',
}

async function release(stacks: CLI) {
  stacks
    .command('release', descriptions.release)
    .option('--debug', descriptions.debug, { default: true }) // it's on by default because it requires manual input
    .action(async (options: ReleaseOptions) => {
      const perf = intro('buddy release')
      const result = await runAction(Action.Release, options)

      if (result.isOk()) {
        outro('Triggered CI/CD release workflow', { startTime: perf, useSeconds: true })
        return result.value
      }

      log.error(result.error)
      process.exit()
    })
}

export { release }
