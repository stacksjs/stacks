import process from 'node:process'
import { type CLI, type FreshOptions } from '@stacksjs/types'
import { runAction } from '@stacksjs/actions'
import { intro, outro } from '@stacksjs/cli'
import { Action, ExitCode } from '@stacksjs/types'

export function migrate(buddy: CLI) {
  const descriptions = {
    migrate: 'Migrates your database',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('migrate', descriptions.migrate)
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: FreshOptions) => {
      const perf = await intro('buddy migrate')
      const result = await runAction(Action.Migrate, { ...options })

      if (result.isErr()) {
        await outro('While running the migrate command, there was an issue', { startTime: perf, useSeconds: true }, result.error)
        process.exit()
      }

      const APP_ENV = process.env.APP_ENV || 'local'

      await outro(`Migrated your ${APP_ENV} database.`, { startTime: perf, useSeconds: true })
      process.exit(ExitCode.Success)
    })
}
