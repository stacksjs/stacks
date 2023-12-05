import process from 'node:process'
import { ExitCode } from 'stacks:types'
import type { CLI, SeedOptions } from 'stacks:types'
import { runAction } from 'stacks:actions'
import { intro, outro } from 'stacks:cli'
import { Action } from 'stacks:enums'

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
      const result = await runAction(Action.Seed, options)

      if (result.isErr()) {
        await outro('While running the seed command, there was an issue', { startTime: perf, useSeconds: true }, result.error)
        process.exit(ExitCode.FatalError)
      }

      const APP_ENV = process.env.APP_ENV || 'local'

      await outro(`Seeded your ${APP_ENV} database.`, { startTime: perf, useSeconds: true })
      process.exit(ExitCode.Success)
    })

  buddy.on('seed:*', () => {
    console.error('Invalid command: %s\nSee --help for a list of available commands.', buddy.args.join(' '))
    process.exit(1)
  })
}
