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
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: SeedOptions & { class?: string }) => {
      log.debug('Running `buddy seed` ...', options)

      const perf = await intro('buddy seed')

      // --class branch: skip the model auto-seeder and run class-based
      // seeders out of database/seeders/ instead. Mirrors Laravel's
      // `php artisan db:seed --class=PostSeeder` ergonomics.
      if (options.class) {
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
