import process from 'node:process'
import { type CLI, type SeedOptions } from '@stacksjs/types'
import { runAction } from '@stacksjs/actions'
import { intro, outro } from '@stacksjs/cli'
import { Action, ExitCode } from '@stacksjs/types'

export function seed(buddy: CLI) {
  const descriptions = {
    seed: 'Seed your database',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('seed', descriptions.seed)
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: SeedOptions) => {
      const perf = await intro('buddy seed')
      const result = runAction(Action.Seed, options)

      if (result.isErr()) {
        await outro('While running the seed command, there was an issue', { startTime: perf, useSeconds: true, isError: true }, result.error as Error)
        process.exit(ExitCode.FatalError)
      }

      const APP_ENV = process.env.APP_ENV || 'local'

      await outro(`Seeded your ${APP_ENV} database.`, { startTime: perf, useSeconds: true })
      process.exit(ExitCode.Success)
    })
}
