import type { CLI, MigrateOptions } from '@stacksjs/types'
import process from 'node:process'
import { runAction } from '@stacksjs/actions'
import { intro, log, outro } from '@stacksjs/cli'
import { Action } from '@stacksjs/enums'
import { ExitCode } from '@stacksjs/types'

export function migrate(buddy: CLI): void {
  const descriptions = {
    migrate: 'Migrates your database',
    project: 'Target a specific project',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('migrate', descriptions.migrate)
    .option('-d, --diff', 'Show the SQL that would be run', { default: false })
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: MigrateOptions) => {
      log.debug('Running `buddy migrate` ...', options)

      const perf = await intro('buddy migrate')
      const result = await runAction(Action.Migrate, options)

      if (result.isErr()) {
        await outro(
          'While running the migrate command, there was an issue',
          { startTime: perf, useSeconds: true },
          result.error,
        )
        process.exit()
      }

      const APP_ENV = process.env.APP_ENV || 'local'

      await outro(`Migrated your ${APP_ENV} database.`, {
        startTime: perf,
        useSeconds: true,
      })
      process.exit(ExitCode.Success)
    })

  buddy
    .command('migrate:fresh', descriptions.migrate)
    .option('-d, --diff', 'Show the SQL that would be run', { default: false })
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: MigrateOptions) => {
      log.debug('Running `buddy migrate:fresh` ...', options)

      const perf = await intro('buddy migrate:fresh')
      const result = await runAction(Action.MigrateFresh, options)

      if (result.isErr()) {
        await outro(
          'While running the migrate:fresh command, there was an issue',
          { startTime: perf, useSeconds: true },
          result.error,
        )
        process.exit()
      }

      await outro(`All tables dropped successfully & migrated successfully`, {
        startTime: perf,
        useSeconds: true,
      })

      process.exit(ExitCode.Success)
    })

  buddy
    .command('migrate:dns', descriptions.migrate)
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: MigrateOptions) => {
      log.debug('Running `buddy migrate:dns` ...', options)

      const perf = await intro('buddy migrate:dns')
      const result = await runAction(Action.MigrateDns, { ...options })

      if (result.isErr()) {
        await outro(
          'While running the migrate:dns command, there was an issue',
          { startTime: perf, useSeconds: true },
          result.error,
        )
        process.exit()
      }

      const APP_URL = process.env.APP_URL || 'undefined'

      await outro(`Migrated your ${APP_URL} DNS.`, {
        startTime: perf,
        useSeconds: true,
      })
      process.exit(ExitCode.Success)
    })

  buddy.on('migrate:*', () => {
    console.error('Invalid command: %s\nSee --help for a list of available commands.', buddy.args.join(' '))
    process.exit(1)
  })
}
