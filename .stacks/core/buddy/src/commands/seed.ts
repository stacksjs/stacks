import type { CLI, FreshOptions } from '@stacksjs/types'
import { seeder } from '@stacksjs/actions/generate'

async function seed(buddy: CLI) {
  const descriptions = {
    seed: 'Seed your database',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('seed', descriptions.seed)
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: FreshOptions) => {
      // const perf = await intro('buddy seed')
      // const result = await runAction(Action.Seed, { ...options, showSpinner: true, spinnerText: 'Seeding...' })

      // if (result.isErr()) {
      //   outro('While running the seed command, there was an issue', { startTime: perf, useSeconds: true, isError: true }, result.error)
      //   process.exit()
      // }

      // const APP_ENV = process.env.APP_ENV || 'local'

      // outro(`Seeded your ${APP_ENV} database.`, { startTime: perf, useSeconds: true })
      // process.exit(ExitCode.Success)

      await seeder()
    })
}

export { seed }
