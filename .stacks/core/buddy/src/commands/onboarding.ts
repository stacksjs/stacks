import type { CLI } from '@stacksjs/types'

export async function onboarding(buddy: CLI) {
  const descriptions = {
    command: 'Generate Onboarding Pages',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('page:onboarding', descriptions.command)
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async () => {
      console.log('onboarding')
      // const startTime = await intro('buddy page:onboarding')
      // const result = await runAction(Action.GenerateOnboarding)
      //
      // if (result.isErr())
      //   process.exit()
      //
      // outro('Pages generated successfully', { startTime })
    })
}
