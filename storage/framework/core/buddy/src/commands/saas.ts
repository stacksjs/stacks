import type { CLI, SaasOptions } from '@stacksjs/types'
import process from 'node:process'
import { runAction } from '@stacksjs/actions'
import { intro, log, outro } from '@stacksjs/cli'
import { Action } from '@stacksjs/enums'
import { ExitCode } from '@stacksjs/types'
import { resultFailed } from '../result'

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

      if (resultFailed(result)) {
        await outro(
          'While running the stripe:setup command, there was an issue',
          { startTime: perf, useSeconds: true },
          result.error,
        )
        process.exit(ExitCode.FatalError)
      }

      // `--dry-run` is a global flag, so it arrives here whether or not this
      // command opts in. It used to be advertised and ignored, which made the
      // preview write real billing objects (stacksjs/stacks#2359); the closing
      // line has to tell the truth about which of the two just happened.
      const dryRun = Boolean((options as { dryRun?: boolean, 'dry-run'?: boolean }).dryRun
        ?? (options as { 'dry-run'?: boolean })['dry-run'])

      await outro(dryRun
        ? 'Dry run complete. Nothing was written to Stripe.'
        : 'Stripe products are up to date', {
        startTime: perf,
        useSeconds: true,
      })

      process.exit(ExitCode.Success)
    })
}
