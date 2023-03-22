import type { CLI, FreshOptions } from '@stacksjs/types'
import { runAction } from '@stacksjs/actions'
import { intro, outro } from '@stacksjs/cli'
import { Action, ExitCode } from '@stacksjs/types'

async function seed(buddy: CLI) {
  const descriptions = {
    seed: 'Seed your database',
    verbose: 'Enable verbose output',
    debug: 'Enable debug mode',
  }

  buddy
    .command('seed', descriptions.seed)
    .option('--verbose', descriptions.verbose, { default: false })
    .option('--debug', descriptions.debug, { default: false })
    .action(async (options: FreshOptions) => {
      const perf = await intro('buddy seed')
      const result = await runAction(Action.Seed, { ...options, showSpinner: true, spinnerText: 'Freshly installing dependencies...' })

      if (result.isErr()) {
        outro('While running the seed command, there was an issue', { startTime: perf, useSeconds: true, isError: true }, result.error)
        process.exit()
      }

      const APP_ENV = process.env.APP_ENV || 'local'

      outro(`Seeded your ${APP_ENV} database.`, { startTime: perf, useSeconds: true })
      process.exit(ExitCode.Success)
    })
}

export { seed }
