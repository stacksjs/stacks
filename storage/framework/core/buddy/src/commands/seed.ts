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

      // stacksjs/stacks#1919 — `./buddy seed` is now class-seeders-only.
      // The legacy model-attribute auto-walker would double-fire on any
      // table that had both a `useSeeder` trait and a class seeder file
      // (N walker rows + class_seeder_count rows, no dedup). Class
      // seeders own orchestration; if a model wants factory rows, the
      // class seeder calls `factory.generate(Model, opts)` explicitly.
      //
      // Adopters with `useSeeder` traits but no class seeder files
      // should run `./buddy seed:scaffold` once to codemod a class
      // seeder per model. We detect that state and tell them.
      const { injectGlobalAutoImports } = await import('@stacksjs/server')
      await injectGlobalAutoImports()
      const { runClassSeeders, listSeedableModels } = await import('@stacksjs/database')
      const { path } = await import('@stacksjs/path')
      const { fs } = await import('@stacksjs/storage')

      const seedableModels = await listSeedableModels()
      const seedersDir = path.projectPath('database/seeders')
      const existingSeederFiles = fs.existsSync(seedersDir)
        ? new Set(fs.readdirSync(seedersDir).filter((f: string) => f.endsWith('.ts')))
        : new Set<string>()

      const unmigratedModels = seedableModels.filter(
        m => !existingSeederFiles.has(`${m.name}Seeder.ts`),
      )

      if (unmigratedModels.length > 0) {
        log.warn(
          `[seed] ${unmigratedModels.length} model(s) declare the deprecated \`useSeeder\` trait but have no class seeder file: `
          + `${unmigratedModels.map(m => m.name).join(', ')}. `
          + `The auto-walker has been removed (stacksjs/stacks#1919) — these models will NOT seed. `
          + `Run \`./buddy seed:scaffold\` to codemod a class seeder per model and strip the trait (stacksjs/stacks#1929), then re-run \`./buddy seed\`.`,
        )
      }

      const classResult = await runClassSeeders()

      const APP_ENV = process.env.APP_ENV || 'local'
      const ran = classResult.ran.length
      await outro(
        `Seeded your ${APP_ENV} database. Class seeders: ran=${ran}, skipped=${classResult.skipped.length}.`,
        { startTime: perf, useSeconds: true },
      )
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
        const stripped = result.strippedTrait.length
        const errors = result.errors.length

        for (const g of result.generated)
          console.log(`  + ${g.model} → ${g.file}`)
        for (const s of result.skipped.filter(s => s.reason === 'already-exists'))
          console.log(`  · ${s.model}: seeder exists (pass --force to overwrite)`)
        // stacksjs/stacks#1929 — report trait removal + anything that
        // needs a manual strip (unusual `useSeeder` value shape).
        for (const t of result.strippedTrait)
          console.log(`  - ${t.model}: removed useSeeder trait from model`)
        for (const t of result.traitStripSkipped)
          log.warn(`  ! ${t.model}: useSeeder value couldn't be auto-removed — strip it manually (${t.file})`)
        for (const e of result.errors)
          log.warn(`  ! ${e.model}: ${e.error}`)

        const verb = options.dryRun ? 'would generate' : 'generated'
        const strippedVerb = options.dryRun ? 'would strip' : 'stripped'
        await outro(
          `Seeder scaffold: ${verb} ${generated}, skipped ${alreadyThere} existing, ${strippedVerb} ${stripped} trait(s), ${errors} error(s).`,
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
