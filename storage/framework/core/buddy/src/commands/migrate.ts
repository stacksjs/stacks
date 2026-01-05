import type { CLI, MigrateOptions } from '@stacksjs/types'
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
      error: 'The app/Models directory does not exist. Please create models before running migrations.',
    }
  }

  const files = readdirSync(modelsPath).filter(f => f.endsWith('.ts') && !f.startsWith('.'))

  if (files.length === 0) {
    return {
      valid: false,
      error: 'No models found in app/Models. Please create at least one model before running migrations.',
    }
  }

  return { valid: true }
}

export function migrate(buddy: CLI): void {
  const descriptions = {
    migrate: 'Migrates your database',
    project: 'Target a specific project',
    verbose: 'Enable verbose output',
    auth: 'Also migrate auth tables (oauth_clients, oauth_access_tokens, oauth_refresh_tokens, password_resets)',
  }

  buddy
    .command('migrate', descriptions.migrate)
    .alias('db:migrate')
    .option('-d, --diff', 'Show the SQL that would be run', { default: false })
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('-a, --auth', descriptions.auth, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: MigrateOptions & { auth?: boolean }) => {
      log.debug('Running `buddy migrate` ...', options)

      const perf = await intro('buddy migrate')

      // Validate models exist before running migrations
      const validation = validateModelsExist()
      if (!validation.valid) {
        console.error(`\n❌ Error: ${validation.error!}\n`)
        process.exit(ExitCode.FatalError)
      }

      const result = await runAction(Action.Migrate, options)

      if (result.isErr) {
        await outro(
          'While running the migrate command, there was an issue',
          { startTime: perf, useSeconds: true },
          result.error,
        )
        process.exit()
      }

      // Run auth table migrations if --auth flag is provided
      if (options.auth) {
        log.info('Migrating auth tables...')
        try {
          const { migrateAuthTables } = await import('@stacksjs/database')
          const authResult = await migrateAuthTables({ verbose: options.verbose })

          if (!authResult.success) {
            log.error(`Failed to migrate auth tables: ${authResult.error}`)
          }
        }
        catch (error) {
          log.error('Failed to migrate auth tables:', error)
        }
      }

      const APP_ENV = process.env.APP_ENV || 'local'

      await outro(`Migrated your ${APP_ENV} database.${options.auth ? ' (including auth tables)' : ''}`, {
        startTime: perf,
        useSeconds: true,
      })
      process.exit(ExitCode.Success)
    })

  buddy
    .command('migrate:fresh', descriptions.migrate)
    .alias('db:fresh')
    .option('-d, --diff', 'Show the SQL that would be run', { default: false })
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('-s, --seed', 'Run database seeders after migration', { default: false })
    .option('-a, --auth', descriptions.auth, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: MigrateOptions & { seed?: boolean, auth?: boolean }) => {
      log.debug('Running `buddy migrate:fresh` ...', options)

      const perf = await intro('buddy migrate:fresh')

      // Validate models exist before running migrations
      const validation = validateModelsExist()
      if (!validation.valid) {
        console.error(`\n❌ Error: ${validation.error!}\n`)
        process.exit(ExitCode.FatalError)
      }

      const result = await runAction(Action.MigrateFresh, options)

      if (result.isErr) {
        await outro(
          'While running the migrate:fresh command, there was an issue',
          { startTime: perf, useSeconds: true },
          result.error,
        )
        process.exit()
      }

      // Run auth table migrations if --auth flag is provided
      if (options.auth) {
        log.info('Migrating auth tables...')
        try {
          const { migrateAuthTables } = await import('@stacksjs/database')
          const authResult = await migrateAuthTables({ verbose: options.verbose })

          if (!authResult.success) {
            log.error(`Failed to migrate auth tables: ${authResult.error}`)
          }
        }
        catch (error) {
          log.error('Failed to migrate auth tables:', error)
        }
      }

      // Run seeders if --seed flag is provided
      if (options.seed) {
        log.info('Running database seeders...')
        try {
          // Import seed dynamically to avoid circular deps and ensure db is initialized
          const { seed } = await import('@stacksjs/database')
          const seedResult = await seed({ verbose: options.verbose })

          if (seedResult.failed > 0) {
            log.warn(`Seeding completed with ${seedResult.failed} failure(s)`)
            for (const r of seedResult.results) {
              if (!r.success) {
                log.error(`  - ${r.model}: ${r.error}`)
              }
            }
          }
          else {
            log.success(`Seeded ${seedResult.successful} model(s)`)
          }
        }
        catch (error) {
          log.error('Failed to run seeders:', error)
        }
      }

      const parts: string[] = []
      if (options.auth) parts.push('auth tables')
      if (options.seed) parts.push('seeded')
      const suffix = parts.length > 0 ? ` & ${parts.join(' & ')}` : ''

      await outro(`All tables dropped successfully & migrated successfully${suffix}`, {
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

      if (result.isErr) {
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
