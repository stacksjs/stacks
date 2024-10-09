import type { CLI, SeedOptions } from '@stacksjs/types'
import process from 'node:process'
import { runAction } from '@stacksjs/actions'
import { intro, log, outro } from '@stacksjs/cli'
import { Action } from '@stacksjs/enums'
import { ExitCode } from '@stacksjs/types'

export function seed(buddy: CLI): void {
  const descriptions = {
    seed: 'Seed your database',
    project: 'Target a specific project',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('seed', descriptions.seed)
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: SeedOptions) => {
      log.debug('Running `buddy seed` ...', options)

      const perf = await intro('buddy seed')
      const result = await runAction(Action.Seed, options)

      if (result.isErr()) {
        await outro(
          'While running the seed command, there was an issue',
          { startTime: perf, useSeconds: true },
          result.error,
        )
        process.exit(ExitCode.FatalError)
      }

      const APP_ENV = process.env.APP_ENV || 'local'

      await outro(`Seeded your ${APP_ENV} database.`, {
        startTime: perf,
        useSeconds: true,
      })
      process.exit(ExitCode.Success)
    })

  buddy.on('seed:*', () => {
    console.error('Invalid command: %s\nSee --help for a list of available commands.', buddy.args.join(' '))
    process.exit(1)
  })
}
