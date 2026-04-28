import type { CLI, MigrateOptions } from '@stacksjs/types'
import { existsSync, mkdirSync, openSync, readdirSync, rmSync } from 'node:fs'
import process from 'node:process'
import { runAction } from '@stacksjs/actions'
import { intro, log, outro } from '@stacksjs/cli'
import { Action } from '@stacksjs/enums'
import { appPath, frameworkPath, projectPath } from '@stacksjs/path'
import { ExitCode } from '@stacksjs/types'

/**
 * File-based migration lock so two `buddy migrate` runs can't race each
 * other on the same database. Returns a `release()` callback even when
 * the lock isn't acquired so callers don't have to special-case.
 *
 * O_EXCL guarantees we either create the lockfile atomically or fail —
 * this is the standard "single-writer" pattern that doesn't depend on
 * any DB-level advisory lock and works on every supported OS.
 */
function acquireMigrationLock(): { acquired: boolean, release: () => void } {
  const lockDir = projectPath('.stacks')
  const lockFile = `${lockDir}/migrations.lock`
  try {
    if (!existsSync(lockDir)) mkdirSync(lockDir, { recursive: true })
    // O_CREAT | O_EXCL | O_WRONLY = 0o102 — atomic create-or-fail
    const fd = openSync(lockFile, 0o102)
    try { /* fd not needed — close immediately */ } finally { /* close happens via release */ }
    void fd
    return {
      acquired: true,
      release: () => {
        try { rmSync(lockFile, { force: true }) } catch { /* ignore */ }
      },
    }
  }
  catch {
    return {
      acquired: false,
      release: () => {/* never acquired, nothing to free */},
    }
  }
}

/**
 * Count model files in a directory (recursively)
 */
function countModelFiles(dir: string): number {
  if (!existsSync(dir)) {
    return 0
  }

  let count = 0
  const entries = readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    if (entry.isDirectory()) {
      count += countModelFiles(`${dir}/${entry.name}`)
    }
    else if (entry.name.endsWith('.ts') && !entry.name.startsWith('.') && !entry.name.startsWith('index')) {
      count++
    }
  }

  return count
}

/**
 * Check if models exist in either user directory or defaults directory
 */
function validateModelsExist(): { valid: boolean, error?: string } {
  const userModelsPath = appPath('Models')
  const defaultModelsPath = frameworkPath('defaults/app/Models')

  const userModelCount = countModelFiles(userModelsPath)
  const defaultModelCount = countModelFiles(defaultModelsPath)

  if (userModelCount === 0 && defaultModelCount === 0) {
    return {
      valid: false,
      error: 'No models found. Please create models in app/Models or ensure framework defaults exist.',
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
    .option('-a, --auth', descriptions.auth, { default: true })
    .option('--no-auth', 'Skip auth/oauth table migrations')
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

      // Acquire a project-local migration lock to prevent two concurrent
      // runs from interleaving DDL on the same database. Two parallel
      // `buddy migrate` invocations on the same project used to corrupt
      // the migration table by both inserting the same row name.
      const lock = acquireMigrationLock()
      if (!lock.acquired) {
        log.error('Another migration is already running (.stacks/migrations.lock exists). Wait for it to finish, or remove the lockfile if it is stale.')
        process.exit(ExitCode.FatalError)
      }

      const result = await runAction(Action.Migrate, options).finally(() => lock.release())

      if (result.isErr) {
        await outro(
          'While running the migrate command, there was an issue',
          { startTime: perf, useSeconds: true },
          result.error,
        )
        process.exit(ExitCode.FatalError)
      }

      // Auth/oauth tables migrate by default. Pass --no-auth to opt out.
      if (options.auth !== false) {
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

      await outro(`Migrated your ${APP_ENV} database.${options.auth !== false ? ' (including auth tables)' : ''}`, {
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
    .option('-a, --auth', descriptions.auth, { default: true })
    .option('--no-auth', 'Skip auth/oauth table migrations')
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
        process.exit(ExitCode.FatalError)
      }

      // Auth/oauth tables migrate by default. Pass --no-auth to opt out.
      if (options.auth !== false) {
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
      if (options.auth !== false) parts.push('auth tables')
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
        process.exit(ExitCode.FatalError)
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
