import type { CLI, FreshOptions } from '@stacksjs/types'
import { runAction } from '@stacksjs/actions'
import { intro, outro } from '@stacksjs/cli'
import { Action, ExitCode } from '@stacksjs/types'

async function migrate(buddy: CLI) {
  const descriptions = {
    migrate: 'Migrates your database',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('migrate', descriptions.migrate)
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: FreshOptions) => {
      const perf = await intro('buddy migrate')
      const result = await runAction(Action.Migrate, { ...options, showSpinner: true, spinnerText: 'Migrating...' })
      console.log('result', result)

      // if (result.isErr()) {
      //   outro('While running the migrate command, there was an issue', { startTime: perf, useSeconds: true, isError: true }, result.error)
      //   process.exit()
      // }

      const APP_ENV = process.env.APP_ENV || 'local'

      outro(`Migrated your ${APP_ENV} database.`, { startTime: perf, useSeconds: true })
      process.exit(ExitCode.Success)
    })
}

export { migrate }
