import type { CLI, MigrateOptions } from '@stacksjs/types'
import { closeSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import process from 'node:process'
import { confirm, intro, log, onUnknownSubcommand, outro } from "@stacksjs/cli"
import { Action } from '@stacksjs/enums'
import { hasTTY, isCI } from '@stacksjs/env'
import { appPath, frameworkPath, projectPath } from '@stacksjs/path'
import { ExitCode } from '@stacksjs/types'

// Lazy-load @stacksjs/actions to keep `buddy --help` cheap. The barrel
// pulls in the database driver setup transitively, which we don't want
// happening just to render the help screen.
let _runAction: typeof import('@stacksjs/actions').runAction | undefined
async function runAction(...args: Parameters<typeof import('@stacksjs/actions').runAction>): ReturnType<typeof import('@stacksjs/actions').runAction> {
  if (!_runAction) _runAction = (await import('@stacksjs/actions')).runAction
  return _runAction(...args)
}

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
    // 'wx' = O_WRONLY | O_CREAT | O_EXCL via Node's portable string mode.
    // The previous numeric flag (0o102) was hard-coded to Linux's bit
    // layout — on macOS that bit pattern omits O_CREAT entirely, so the
    // lock acquisition ALWAYS failed with ENOENT (no such file), which
    // tripped the "already running" branch and silently exited the
    // entire migrate command via process.exit() with no visible reason.
    const fd = openSync(lockFile, 'wx')
    try { closeSync(fd) } catch { /* ignore */ }
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
 * Read + clear the marker file the migration subprocess wrote to
 * communicate how many migrations actually ran. Returns `null` when
 * the file is missing or malformed — callers fall back to the
 * generic outro in that case.
 *
 * The subprocess writes this from `runDatabaseMigration` in
 * `@stacksjs/database`. We delete after reading so a later command
 * doesn't see stale state.
 */
function readMigrateMarker(): { appliedCount: number } | null {
  const file = projectPath('.stacks/last-migrate-result.json')
  if (!existsSync(file)) return null
  try {
    const raw = readFileSync(file, 'utf8')
    const parsed = JSON.parse(raw) as { appliedCount?: unknown }
    const n = typeof parsed.appliedCount === 'number' ? parsed.appliedCount : null
    if (n === null || !Number.isFinite(n)) return null
    return { appliedCount: Math.max(0, Math.floor(n)) }
  }
  catch {
    return null
  }
  finally {
    try { rmSync(file, { force: true }) } catch { /* ignore */ }
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

/**
 * Post-migrate FK integrity probe (stacksjs/stacks#1915 D-5).
 *
 * Catches the silent "you flipped DB_CONNECTION but the FKs didn't
 * follow" failure mode while the user is still at the `migrate` step,
 * which is the highest-context moment to surface it. Treats audit
 * failure as a non-fatal warning so a misconfigured DB driver or a
 * missing introspection permission doesn't break the migrate command —
 * the user can always run `buddy doctor` for the structured view.
 */
async function reportMissingForeignKeys(): Promise<void> {
  try {
    const { auditForeignKeys } = await import('@stacksjs/database')
    const result = await auditForeignKeys()
    if (result.missing.length === 0) return

    const sample = result.missing
      .slice(0, 5)
      .map(fk => `  • ${fk.fromTable}.${fk.fromColumn} → ${fk.toTable}.${fk.toColumn} (${fk.model})`)
      .join('\n')
    const more = result.missing.length > 5 ? `\n  + ${result.missing.length - 5} more — run \`./buddy doctor\` for the full list.` : ''
    log.warn(
      `${result.missing.length} of ${result.declared.length} declared foreign keys are missing from the live schema:\n${sample}${more}\n`
      + `If you just flipped DB_CONNECTION, the FK ALTER migrations may be sitting on disk but unapplied — run \`./buddy migrate:fresh\` against the new database (will reset data) or replay the alter-*.sql files manually.`,
    )
  }
  catch (err) {
    log.debug(`[migrate] FK integrity check skipped: ${err instanceof Error ? err.message : String(err)}`)
  }
}

interface MigrationOpLike {
  kind: string
  table: string
  column?: string
  from?: string
  to?: string
  destructive: boolean
}

/** Human-readable one-liner for a pending operation. */
function describeOp(op: MigrationOpLike): string {
  switch (op.kind) {
    case 'drop_table':
      return `drop table "${op.table}" (all rows lost)`
    case 'drop_column':
      return `drop column "${op.table}"."${op.column}" (column data lost)`
    case 'modify_column':
      return `change type of "${op.table}"."${op.column}" (possible data loss)`
    case 'rebuild_table':
      return `rebuild table "${op.table}" (type/constraint change)`
    case 'rename_column':
      return `rename "${op.table}"."${op.from}" → "${op.to}"`
    case 'rename_table':
      return `rename table "${op.from}" → "${op.to}"`
    default:
      return `${op.kind} on "${op.table}"${op.column ? `."${op.column}"` : ''}`
  }
}

/**
 * Gate destructive schema changes behind confirmation. Returns true to proceed,
 * false to abort. Runs in the interactive PARENT process (the migrate action
 * subprocess has no TTY), previewing the pending operations without applying.
 */
async function confirmDestructiveMigrations(opts: { force?: boolean, fromDb?: boolean, applyRenames?: boolean }): Promise<boolean> {
  let operations: MigrationOpLike[] = []
  try {
    const { previewPendingMigrations } = await import('@stacksjs/database')
    operations = (await previewPendingMigrations({ fromDb: opts.fromDb, applyRenames: opts.applyRenames })) as MigrationOpLike[]
  }
  catch (error) {
    // If preview fails we can't classify changes — don't block; the real
    // generate runs next with full error handling.
    log.debug(`Migration preview unavailable: ${error instanceof Error ? error.message : String(error)}`)
    return true
  }

  // Report data-preserving renames so the user knows data was kept.
  const renames = operations.filter(o => o.kind === 'rename_column' || o.kind === 'rename_table')
  for (const r of renames)
    log.info(`Detected ${describeOp(r)} — applying as a rename (data preserved). Use --no-rename to drop + add instead.`)

  const destructive = operations.filter(o => o.destructive)
  if (destructive.length === 0)
    return true

  log.warn(`This migration includes ${destructive.length} potentially destructive change${destructive.length === 1 ? '' : 's'}:`)
  for (const op of destructive)
    log.warn(`  • ${describeOp(op)}`)

  if (opts.force)
    return true

  // Non-interactive (CI or no TTY): never silently drop data.
  if (isCI || !hasTTY) {
    log.error('Refusing to apply destructive changes in a non-interactive environment. Re-run with --force to proceed.')
    return false
  }

  return confirm({ message: 'Apply these destructive changes?', initial: false })
}

export function migrate(buddy: CLI): void {
  const descriptions = {
    migrate: 'Migrates your database',
    project: 'Target a specific project',
    verbose: 'Enable verbose output',
    auth: 'Also migrate auth tables (oauth_clients, oauth_access_tokens, oauth_refresh_tokens, password_resets)',
    force: 'Apply destructive changes (drop column/table, lossy type change) without confirmation',
    fromDb: 'Diff against the live database schema instead of the snapshot (self-heal drift)',
    noRename: 'Treat renamed columns as drop + add instead of a data-preserving rename',
  }

  buddy
    .command('migrate', descriptions.migrate)
    .alias('db:migrate')
    .option('-d, --diff', 'Show the SQL that would be run', { default: false })
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('-a, --auth', descriptions.auth, { default: true })
    .option('--no-auth', 'Skip auth/oauth table migrations')
    .option('-f, --force', descriptions.force, { default: false })
    .option('--from-db', descriptions.fromDb, { default: false })
    .option('--no-rename', descriptions.noRename)
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: MigrateOptions & { auth?: boolean, force?: boolean, fromDb?: boolean, rename?: boolean }) => {
      log.debug('Running `buddy migrate` ...', options)

      const perf = await intro('buddy migrate')

      // Validate models exist before running migrations
      const validation = validateModelsExist()
      if (!validation.valid) {
        console.error(`\n❌ Error: ${validation.error!}\n`)
        process.exit(ExitCode.FatalError)
      }

      // Thread the rename / from-db decisions across the action subprocess
      // boundary via env (the child inherits process.env). cac maps
      // `--no-rename` to `rename === false` and `--from-db` to `fromDb`.
      const applyRenames = options.rename === false ? false : undefined
      if (options.fromDb)
        process.env.STACKS_MIGRATE_FROM_DB = '1'
      if (applyRenames === false)
        process.env.STACKS_MIGRATE_NO_RENAME = '1'

      // --diff: dry-run only. Preview the pending operations + SQL and exit
      // without writing files or applying anything.
      if (options.diff) {
        try {
          const { previewPendingMigrations } = await import('@stacksjs/database')
          const ops = await previewPendingMigrations({ fromDb: options.fromDb, applyRenames })
          if (ops.length === 0) {
            log.info('No pending schema changes — your models match the database.')
          }
          else {
            log.info(`${ops.length} pending change${ops.length === 1 ? '' : 's'}:`)
            for (const op of ops as MigrationOpLike[])
              log.info(`  • ${describeOp(op)}${op.destructive ? '  [destructive]' : ''}`)
          }
        }
        catch (error) {
          log.error('Failed to preview migrations:', error)
        }
        await outro('Diff complete — no changes applied.', { startTime: perf, useSeconds: true })
        process.exit(ExitCode.Success)
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

      // Gate destructive changes (drop column/table, lossy type change) behind
      // confirmation while we still have the interactive TTY — the migrate
      // action runs in a non-interactive subprocess.
      const proceed = await confirmDestructiveMigrations({ force: options.force, fromDb: options.fromDb, applyRenames })
      if (!proceed) {
        lock.release()
        await outro('Migration cancelled — no changes applied.', { startTime: perf, useSeconds: true })
        process.exit(ExitCode.Success)
      }

      // Auth/oauth/notification/RBAC tables migrate by default, and run
      // BEFORE the numbered model migrations (not after — see
      // stacksjs/stacks#1952 for why this used to run last). Migration
      // 0000000098-revoke-legacy-long-lived-tokens.sql (and any future
      // migration touching oauth_access_tokens/oauth_refresh_tokens)
      // assumes these framework tables already exist; on a brand new
      // `buddy new` project there is no prior `buddy migrate --auth` run
      // to have created them, so that migration hard-failed with
      // "no such table: oauth_access_tokens" on every fresh install. The
      // SQL here is all idempotent `CREATE TABLE IF NOT EXISTS` /
      // defensive `ALTER`, so running it first is a no-op on databases
      // that already have these tables. Pass --no-auth to opt out.
      if (options.auth !== false) {
        // Step-progress at debug — the auth-tables SQL is all
        // `CREATE TABLE IF NOT EXISTS`, so re-runs are no-ops and the
        // user shouldn't see an "ℹ Migrating auth tables..." line
        // every time. Errors still surface via log.error below.
        log.debug('Migrating auth tables...')
        try {
          const { migrateAuthTables, migrateNotificationTables, migrateRbacTables } = await import('@stacksjs/database')
          const authResult = await migrateAuthTables({ verbose: options.verbose })

          if (!authResult.success) {
            log.error(`Failed to migrate auth tables: ${authResult.error}`)
          }

          // Notification tables (stacksjs/stacks#1937) — the `database`
          // channel + preference layer need these; previously unshipped.
          const notifResult = await migrateNotificationTables({ verbose: options.verbose })
          if (!notifResult.success) {
            log.error(`Failed to migrate notification tables: ${notifResult.error}`)
          }

          // RBAC tables (stacksjs/stacks#1941 Phase A) — roles,
          // permissions, and the three pivot tables the RBAC store
          // reads. Schema was documented in rbac-store-bqb.ts but the
          // migration never shipped.
          const rbacResult = await migrateRbacTables({ verbose: options.verbose })
          if (!rbacResult.success) {
            log.error(`Failed to migrate RBAC tables: ${rbacResult.error}`)
          }
        }
        catch (error) {
          log.error('Failed to migrate auth/notification/RBAC tables:', error)
        }
      }

      const result = await runAction(Action.Migrate, options).finally(() => lock.release())

      if (result.isErr) {
        log.error('Model migrations failed.')
      }

      // Surface the model-migration failure only after the guarantee
      // tables above have had their chance to run (#1952).
      if (result.isErr) {
        await outro(
          'While running the migrate command, there was an issue',
          { startTime: perf, useSeconds: true },
          result.error,
        )
        process.exit(ExitCode.FatalError)
      }

      // Post-migrate FK integrity check (stacksjs/stacks#1915 D-5).
      // Surfaces the "you flipped DB_CONNECTION and the FKs didn't
      // follow" failure mode while the user is still at the migrate
      // command — the highest-context moment to warn.
      await reportMissingForeignKeys()

      const APP_ENV = process.env.APP_ENV || 'local'

      // Pick a message that tells the user what actually happened.
      // Pre-fix the outro always said "Migrated your <env> database"
      // even when zero migrations ran — common when re-issuing the
      // command after `migrate:fresh` or another `migrate`. The
      // subprocess writes the applied count to a marker file we read
      // here.
      const marker = readMigrateMarker()
      const authSuffix = options.auth !== false ? ' (including auth tables)' : ''
      const outroMessage = marker == null
        ? `Migrated your ${APP_ENV} database.${authSuffix}`
        : marker.appliedCount === 0
          ? `Nothing to migrate — your ${APP_ENV} database is already up to date.${authSuffix}`
          : `Applied ${marker.appliedCount} migration${marker.appliedCount === 1 ? '' : 's'} to your ${APP_ENV} database.${authSuffix}`

      await outro(outroMessage, {
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
        // Same ordering rule as `buddy migrate` (#1952): the guarantee
        // tables below are independent, idempotent SQL — a failed model
        // migration must not skip them. Exit comes after they ran.
        log.error('Model migrations failed — applying auth/notification/RBAC table guarantees before exiting.')
      }

      // Auth/oauth tables migrate by default. Pass --no-auth to opt out.
      if (options.auth !== false) {
        // Step-progress at debug — the auth-tables SQL is all
        // `CREATE TABLE IF NOT EXISTS`, so re-runs are no-ops and the
        // user shouldn't see an "ℹ Migrating auth tables..." line
        // every time. Errors still surface via log.error below.
        log.debug('Migrating auth tables...')
        try {
          const { migrateAuthTables, migrateNotificationTables, migrateRbacTables } = await import('@stacksjs/database')
          const authResult = await migrateAuthTables({ verbose: options.verbose })

          if (!authResult.success) {
            log.error(`Failed to migrate auth tables: ${authResult.error}`)
          }

          // Notification tables (stacksjs/stacks#1937) — the `database`
          // channel + preference layer need these; previously unshipped.
          const notifResult = await migrateNotificationTables({ verbose: options.verbose })
          if (!notifResult.success) {
            log.error(`Failed to migrate notification tables: ${notifResult.error}`)
          }

          // RBAC tables (stacksjs/stacks#1941 Phase A) — roles,
          // permissions, and the three pivot tables the RBAC store
          // reads. Schema was documented in rbac-store-bqb.ts but the
          // migration never shipped.
          const rbacResult = await migrateRbacTables({ verbose: options.verbose })
          if (!rbacResult.success) {
            log.error(`Failed to migrate RBAC tables: ${rbacResult.error}`)
          }
        }
        catch (error) {
          log.error('Failed to migrate auth/notification/RBAC tables:', error)
        }
      }

      // Surface the model-migration failure only after the guarantee
      // tables above have had their chance to run (#1952).
      if (result.isErr) {
        await outro(
          'While running the migrate:fresh command, there was an issue',
          { startTime: perf, useSeconds: true },
          result.error,
        )
        process.exit(ExitCode.FatalError)
      }

      // Post-migrate FK integrity check (stacksjs/stacks#1915 D-5).
      await reportMissingForeignKeys()

      // Run seeders if --seed flag is provided.
      //
      // `migrate:fresh` truncates the database, so passing `fresh: true`
      // to the seeder here lifts the protected-model guard
      // (stacksjs/stacks#1852) — there are no live tokens to invalidate.
      if (options.seed) {
        log.info('Running database seeders...')
        try {
          // Import seed dynamically to avoid circular deps and ensure db is initialized
          const { seed } = await import('@stacksjs/database')
          const seedResult = await seed({ verbose: options.verbose, fresh: true })

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

      // Surface the applied count when the marker file is available
      // — `migrate:fresh` drops the schema before migrating, so this
      // is effectively the total migration count for the project.
      // Useful confirmation that the rebuild matched expectations.
      const marker = readMigrateMarker()
      const countPhrase = marker == null
        ? ''
        : marker.appliedCount === 0
          ? ' (0 applied — no migration files found?)'
          : ` (${marker.appliedCount} migration${marker.appliedCount === 1 ? '' : 's'} applied)`

      await outro(`All tables dropped successfully & migrated successfully${countPhrase}${suffix}`, {
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

  // `buddy migrate:switch <driver>` — pre-flight + plan for flipping
  // DB_CONNECTION between sqlite / mysql / postgres
  // (stacksjs/stacks#1915 D-4).
  //
  // Intentionally does NOT mutate .env or auto-run migrations. The
  // intent here is to surface the silent traps documented in #1915
  // (timestamp TZ drift, auth-table boolean mismatch, FK migration
  // files that need replaying on the new dialect) BEFORE the user
  // commits to the switch. The output is a checklist they walk
  // through manually — the actual migration is still `buddy migrate`
  // (or `migrate:fresh`) once the env is updated.
  buddy
    .command('migrate:switch <driver>', 'Pre-flight check + plan for switching DB_CONNECTION between sqlite / mysql / postgres')
    .action(async (driver: string) => {
      log.debug(`Running \`buddy migrate:switch ${driver}\` ...`)
      const perf = await intro('buddy migrate:switch')

      const target = driver.toLowerCase()
      const allowed = new Set(['sqlite', 'mysql', 'postgres'])
      if (!allowed.has(target)) {
        // eslint-disable-next-line no-console
        console.log(`\n  Unknown target driver "${driver}". Allowed: sqlite, mysql, postgres.\n`)
        await outro(`Aborted.`, { startTime: perf, useSeconds: true })
        process.exit(ExitCode.FatalError)
      }

      const current = (process.env.DB_CONNECTION || 'sqlite').toLowerCase()
      if (current === target) {
        // eslint-disable-next-line no-console
        console.log(`\n  DB_CONNECTION is already "${target}". Nothing to switch.\n`)
        await outro(`No-op.`, { startTime: perf, useSeconds: true })
        process.exit(ExitCode.Success)
      }

      // Pre-flight: the target driver's env vars must be present
      // before the user kicks off `buddy migrate` against it.
      const requiredEnv: Record<string, string[]> = {
        sqlite: ['DB_DATABASE'],
        mysql: ['DB_HOST', 'DB_PORT', 'DB_USERNAME', 'DB_PASSWORD', 'DB_DATABASE'],
        postgres: ['DB_HOST', 'DB_PORT', 'DB_USERNAME', 'DB_PASSWORD', 'DB_DATABASE'],
      }
      const missingEnv = (requiredEnv[target] ?? []).filter(k => !process.env[k])

      // Count migration files that exist on disk for replay. The
      // FK ALTER / unique-index files that the SQLite preprocessing
      // pass skipped (stacksjs/stacks#1916) are exactly the ones
      // that will run when migrate is re-invoked against the new
      // driver.
      let alterCount = 0
      let uniqueIdxCount = 0
      try {
        const migrationsDir = projectPath('database/migrations')
        if (existsSync(migrationsDir)) {
          const files = readdirSync(migrationsDir).filter(f => f.endsWith('.sql'))
          for (const f of files) {
            const content = readFileSync(`${migrationsDir}/${f}`, 'utf-8').toLowerCase()
            if (/alter\s+table[\s\S]*add\s+constraint/.test(content)) alterCount++
            if (/^\s*create\s+unique\s+index/m.test(content)) uniqueIdxCount++
          }
        }
      }
      catch { /* directory missing — fine */ }

      // The plan is rendered with `console.log` (sync, flushes
      // before `process.exit`) rather than `log.info` (async-
      // buffered, can drop on early exit). The `log.*` helpers are
      // great for the long-running migrate command but the wrong
      // tool for this short-lived static report.
      const sqliteFkNote = current === 'sqlite' && alterCount > 0
        ? `\n    (These were skipped on SQLite per stacksjs/stacks#1916 and survive on disk for replay.)`
        : ''
      const boolNote = current === 'sqlite' && (target === 'postgres' || target === 'mysql')
        ? `\n  • Booleans land as 0/1 on SQLite; ${target} stores them as ${target === 'postgres' ? 'true/false' : '0/1 (compatible)'}.`
        : ''
      const tzNote = target === 'postgres'
        ? `\n  • PostgreSQL uses timestamptz (with TZ) where SQLite/MySQL store plain TIMESTAMP. Existing rows do NOT auto-upgrade — they ride the column's stored type.`
        : ''
      const envExtras = target !== 'sqlite' ? `, plus DB_HOST / DB_PORT / DB_USERNAME / DB_PASSWORD / DB_DATABASE` : ``
      const missingNote = missingEnv.length > 0
        ? `\n  ⚠ Missing env vars for ${target}: ${missingEnv.join(', ')}`
        : ''

      // eslint-disable-next-line no-console
      console.log(`
  Switch plan: ${current} → ${target}
  ─────────────────────────────────────────────
  • ${alterCount} ALTER TABLE ADD CONSTRAINT migration(s) will be applied against ${target}.${sqliteFkNote}
  • ${uniqueIdxCount} CREATE UNIQUE INDEX migration(s) will be applied against ${target}.
  • Auth tables (oauth_clients, oauth_access_tokens, oauth_refresh_tokens, password_resets) will be CREATE TABLE IF NOT EXISTS — they re-create cleanly under the new dialect.${boolNote}${tzNote}
  • Existing row data does NOT auto-migrate. Use \`mysqldump\` / \`pg_dump\` (or your own export) to move it.${missingNote}
  ─────────────────────────────────────────────

  Next steps:
    1. Update .env:  DB_CONNECTION=${target}${envExtras}
    2. (Optional) Export data from the current ${current} database.
    3. Run \`./buddy migrate\` (or \`migrate:fresh\` to start clean).
    4. The post-migrate FK audit will report any constraints that didn't replay.
`)

      await outro(`Plan rendered. Re-run after updating .env to actually switch.`, {
        startTime: perf,
        useSeconds: true,
      })
      process.exit(ExitCode.Success)
    })

  onUnknownSubcommand(buddy, "migrate")
}
