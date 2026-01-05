import type { CLI, SeedOptions } from '@stacksjs/types'
import { existsSync, readdirSync } from 'node:fs'
import process from 'node:process'
import { runAction } from '@stacksjs/actions'
import { intro, log, outro } from '@stacksjs/cli'
import { Action } from '@stacksjs/enums'
import { appPath } from '@stacksjs/path'
import { ExitCode } from '@stacksjs/types'

/**
 * Check if app/Models directory exists and has model files
 */
function validateModelsExist(): { valid: boolean, error?: string } {
  const modelsPath = appPath('Models')

  if (!existsSync(modelsPath)) {
    return {
      valid: false,
      error: 'The app/Models directory does not exist. Please create models before running seeders.',
    }
  }

  const files = readdirSync(modelsPath).filter(f => f.endsWith('.ts') && !f.startsWith('.'))

  if (files.length === 0) {
    return {
      valid: false,
      error: 'No models found in app/Models. Please create at least one model before running seeders.',
    }
  }

  return { valid: true }
}

export function seed(buddy: CLI): void {
  const descriptions = {
    seed: 'Seed your database',
    project: 'Target a specific project',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('seed', descriptions.seed)
    .alias('db:seed')
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: SeedOptions) => {
      log.debug('Running `buddy seed` ...', options)

      const perf = await intro('buddy seed')

      // Validate models exist before running seeders
      const validation = validateModelsExist()
      if (!validation.valid) {
        console.error(`\n❌ Error: ${validation.error!}\n`)
        process.exit(ExitCode.FatalError)
      }

      const result = await runAction(Action.Seed, options)

      if (result.isErr) {
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
