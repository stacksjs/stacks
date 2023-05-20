import type { CLI } from '@stacksjs/types'
import { intro, outro } from '@stacksjs/cli'
import { Action } from '@stacksjs/types'
import { runAction } from '@stacksjs/actions'

async function onboarding(buddy: CLI) {
  const descriptions = {
    command: 'Generate Onboarding Pages',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('page:onboarding', descriptions.command)
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async () => {
      const startTime = await intro('buddy page:onboarding')
      const result = await runAction(Action.GenerateOnboarding)

      if (result.isErr()) {
        log.error('Something went wrong when generating', result.error as Error)
        process.exit()
      }

      outro('Pages generated successfully', { startTime })
    })
}

export { onboarding }
