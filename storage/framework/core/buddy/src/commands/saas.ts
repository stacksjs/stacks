import type { CLI, SaasOptions } from '@stacksjs/types'
import process from 'node:process'
import { runAction } from '@stacksjs/actions'
import { intro, log, outro } from '@stacksjs/cli'
import { Action } from '@stacksjs/enums'
import { ExitCode } from '@stacksjs/types'

export function saas(buddy: CLI): void {
  const descriptions = {
    stripe: 'Sets up stripe products in the dashboard',
    project: 'Target a specific project',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('stripe:setup', descriptions.stripe)
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: SaasOptions) => {
      log.debug('Running `buddy stripe:setup` ...', options)

      const perf = await intro('buddy stripe:setup')
      const result = await runAction(Action.StripeSetup, options)

      if (result.isErr()) {
        await outro(
          'While running the stripe:setup command, there was an issue',
          { startTime: perf, useSeconds: true },
          result.error,
        )
        process.exit()
      }

      await outro(`Stripe products created successfully`, {
        startTime: perf,
        useSeconds: true,
      })

      process.exit(ExitCode.Success)
    })
}
