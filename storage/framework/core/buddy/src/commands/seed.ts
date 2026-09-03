import type { CLI, SeedOptions } from '@stacksjs/types'
import process from 'node:process'
import { intro, log, onUnknownSubcommand, outro } from "@stacksjs/cli"
import { ExitCode } from '@stacksjs/types'

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
    .option('--only [models]', 'Comma-separated list of models to seed', { default: '' })
    .option('--except [models]', 'Comma-separated list of models to skip', { default: '' })
    .option('--only-seeders [seeders]', 'Comma-separated list of application seeder classes to run', { default: '' })
    .option('--except-seeders [seeders]', 'Comma-separated list of application seeder classes to skip', { default: '' })
    .option('--skip-models', 'Skip model-factory seeding', { default: false })
    .option('--skip-application-seeders', 'Skip application seeders', { default: false })
    .option('--include-defaults', 'Also seed the framework\'s built-in models', { default: false })
    // Escape hatch for the protected-model guard (stacksjs/stacks#1852).
    // By default `./buddy seed` skips auth/oauth models on a non-fresh
    // database so re-rolling the Personal Access Client secret doesn't
    // silently invalidate every currently-logged-in user's session.
    // Pass --allow-protected to override.
    .option('--allow-protected', 'Seed auth/oauth models even on a non-fresh DB (will invalidate live tokens)', { default: false })
    .option('--fresh', 'Truncate tables before seeding', { default: false })
    .option('--append', 'Add rows to tables that already have some, instead of skipping them', { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: SeedOptions & { only?: string, except?: string, onlySeeders?: string, exceptSeeders?: string, skipModels?: boolean, skipApplicationSeeders?: boolean, includeDefaults?: boolean, allowProtected?: boolean, fresh?: boolean, append?: boolean, verbose?: boolean }) => {
      log.debug('Running `buddy seed` ...', options)

      const perf = await intro('buddy seed')

      // Seeding walks every model carrying a `useSeeder` trait and fills its
      // table from the per-attribute `factory: faker => …` declarations. The
      // trait is where a model's seed count and fixtures live, so the model
      // stays the single place its data shape is described.
      const { injectGlobalAutoImports } = await import('@stacksjs/server')
      await injectGlobalAutoImports()
      const { runApplicationSeeders, seed: seedDatabase } = await import('@stacksjs/database')

      const list = (value?: string): string[] | undefined =>
        value ? value.split(',').map(entry => entry.trim()).filter(Boolean) : undefined

      const summary = options.skipModels
        ? { total: 0, successful: 0, failed: 0, results: [], duration: 0 }
        : await seedDatabase({
            verbose: options.verbose,
            fresh: options.fresh,
            append: options.append,
            only: list(options.only),
            except: list(options.except),
            includeDefaults: options.includeDefaults,
            allowProtected: options.allowProtected,
          })
      const applicationSummary = options.skipApplicationSeeders
        ? { total: 0, successful: 0, failed: 0, results: [], duration: 0 }
        : await runApplicationSeeders({
            verbose: options.verbose,
            only: list(options.onlySeeders),
            except: list(options.exceptSeeders),
          })

      const APP_ENV = process.env.APP_ENV || 'local'

      if (summary.total === 0 && applicationSummary.total === 0) {
        await outro(
          `No matching model or application seeders were found.`,
          { startTime: perf, useSeconds: true },
        )
        process.exit(ExitCode.Success)
      }

      const failures = summary.failed + applicationSummary.failed
      await outro(
        `Seeded your ${APP_ENV} database. ${summary.successful}/${summary.total} model(s) and ${applicationSummary.successful}/${applicationSummary.total} application seeder(s) completed${failures > 0 ? `, ${failures} failed` : ''}.`,
        { startTime: perf, useSeconds: true },
      )
      process.exit(failures > 0 ? ExitCode.FatalError : ExitCode.Success)
    })

  // `./buddy seed:roles` — idempotently seed the default RBAC role packs
  // (admin, dev, client) introduced in stacksjs/stacks#1843. Re-runs are
  // safe — existing rows are skipped, not duplicated.
  buddy
    .command('seed:roles', 'Seed default RBAC role packs (admin, dev, client)')
    .alias('roles:seed')
    .action(async () => {
      const perf = await intro('buddy seed:roles')
      try {
        const { seedDefaultRoles } = await import('@stacksjs/auth')
        const result = await seedDefaultRoles()
        if (result.created.length === 0 && result.skipped.length > 0) {
          await outro(
            `All ${result.skipped.length} default role packs already exist - nothing to do.`,
            { startTime: perf, useSeconds: true },
          )
        }
        else {
          const createdNames = result.created.map(r => r.name).join(', ')
          await outro(
            `Created ${result.created.length} role pack(s): ${createdNames}. Skipped ${result.skipped.length} existing.`,
            { startTime: perf, useSeconds: true },
          )
        }
        process.exit(ExitCode.Success)
      }
      catch (err) {
        await outro(
          'Failed to seed default roles. Most often: migrations haven\'t run yet (try `./buddy migrate` first).',
          { startTime: perf, useSeconds: true },
          err as Error,
        )
        process.exit(ExitCode.FatalError)
      }
    })

  onUnknownSubcommand(buddy, "seed")
}
