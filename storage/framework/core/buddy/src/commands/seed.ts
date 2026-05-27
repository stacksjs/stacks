import type { CLI, SeedOptions } from '@stacksjs/types'
import { existsSync, readdirSync } from 'node:fs'
import process from 'node:process'
import { runAction } from '@stacksjs/actions'
import { intro, log, onUnknownSubcommand, outro } from "@stacksjs/cli"
import { Action } from '@stacksjs/enums'
import { appPath, frameworkPath } from '@stacksjs/path'
import { ExitCode } from '@stacksjs/types'

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
    .option('-c, --class [class]', 'Run a specific seeder class from database/seeders/', { default: '' })
    // Escape hatch for the protected-model guard (stacksjs/stacks#1852).
    // By default `./buddy seed` skips auth/oauth models on a non-fresh
    // database so re-rolling the Personal Access Client secret doesn't
    // silently invalidate every currently-logged-in user's session.
    // Pass --allow-protected to override.
    .option('--allow-protected', 'Seed auth/oauth models even on a non-fresh DB (will invalidate live tokens)', { default: false })
    .option('--fresh', 'Truncate tables before seeding', { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: SeedOptions & { class?: string, allowProtected?: boolean, fresh?: boolean }) => {
      log.debug('Running `buddy seed` ...', options)

      const perf = await intro('buddy seed')

      // --class branch: skip the model auto-seeder and run class-based
      // seeders out of database/seeders/ instead. Mirrors Laravel's
      // `php artisan db:seed --class=PostSeeder` ergonomics.
      if (options.class) {
        const { injectGlobalAutoImports } = await import('@stacksjs/server')
        await injectGlobalAutoImports()
        const { runClassSeeders } = await import('@stacksjs/database')
        const result = await runClassSeeders({ class: options.class })
        await outro(
          `Class seeders: ran=${result.ran.length}, skipped=${result.skipped.length}`,
          { startTime: perf, useSeconds: true },
        )
        process.exit(result.ran.length > 0 ? ExitCode.Success : ExitCode.FatalError)
      }

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

      // After model auto-seeding, also run class seeders if any exist —
      // they're usually composition layers on top of the auto-seeded data.
      try {
        const { injectGlobalAutoImports } = await import('@stacksjs/server')
        await injectGlobalAutoImports()
        const { runClassSeeders } = await import('@stacksjs/database')
        const classResult = await runClassSeeders()
        if (classResult.ran.length > 0) {
          log.info(`Also ran ${classResult.ran.length} class seeder(s): ${classResult.ran.join(', ')}`)
        }
      }
      catch (err) {
        log.warn('Class seeders failed (non-fatal):', err)
      }

      const APP_ENV = process.env.APP_ENV || 'local'

      await outro(`Seeded your ${APP_ENV} database.`, {
        startTime: perf,
        useSeconds: true,
      })
      process.exit(ExitCode.Success)
    })

  // `./buddy seed:scaffold` — codemod for stacksjs/stacks#1919. Reads
  // every model with a `useSeeder` trait and emits a corresponding
  // `database/seeders/<Model>Seeder.ts` file so adopters can migrate
  // off the deprecated auto-walker. Skips models that already have a
  // seeder file unless `--force` is passed; `--dry-run` prints what
  // would be written without touching disk.
  buddy
    .command('seed:scaffold', 'Generate class seeders for every model with a useSeeder trait (codemod for stacksjs/stacks#1919)')
    .option('--force', 'Overwrite existing seeder files', { default: false })
    .option('--dry-run', 'Print what would be generated without writing files', { default: false })
    .action(async (options: { force?: boolean, dryRun?: boolean }) => {
      const perf = await intro('buddy seed:scaffold')
      try {
        const { scaffoldClassSeedersFromModels } = await import('@stacksjs/database')
        const result = await scaffoldClassSeedersFromModels({
          force: options.force,
          dryRun: options.dryRun,
        })

        const generated = result.generated.length
        const alreadyThere = result.skipped.filter(s => s.reason === 'already-exists').length
        const errors = result.errors.length

        for (const g of result.generated)
          console.log(`  + ${g.model} → ${g.file}`)
        for (const s of result.skipped.filter(s => s.reason === 'already-exists'))
          console.log(`  · ${s.model}: skipped (file exists; pass --force to overwrite)`)
        for (const e of result.errors)
          log.warn(`  ! ${e.model}: ${e.error}`)

        const verb = options.dryRun ? 'would generate' : 'generated'
        await outro(
          `Seeder scaffold: ${verb} ${generated}, skipped ${alreadyThere} existing, ${errors} error(s).`,
          { startTime: perf, useSeconds: true },
        )
        process.exit(errors > 0 && generated === 0 ? ExitCode.FatalError : ExitCode.Success)
      }
      catch (err) {
        await outro(
          'seed:scaffold failed',
          { startTime: perf, useSeconds: true },
          err as Error,
        )
        process.exit(ExitCode.FatalError)
      }
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
            `All ${result.skipped.length} default role packs already exist — nothing to do.`,
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
