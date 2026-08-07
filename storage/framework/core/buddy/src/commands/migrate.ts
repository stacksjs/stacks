import type { CLI, MigrateOptions } from '@stacksjs/types'
import { closeSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { relative } from 'node:path'
import process from 'node:process'
import { confirm, intro, log, onUnknownSubcommand, outro, text } from "@stacksjs/cli"
import { Action } from '@stacksjs/enums'
import { hasTTY, isCI } from '@stacksjs/env'
import { appPath, frameworkPath, frameworkRuntimePath, projectPath } from '@stacksjs/path'
import { ExitCode } from '@stacksjs/types'
import { preflightDatabase } from '../database-preflight'
import { DDL_CONSTRAINT_OVERRIDE_ENV, DIALECT_OVERRIDE_ENV, auditDdlConstraints, auditMigrationCorpus, dialectCapabilities, formatDdlConstraintError, formatMigrationDialectError, relativeMigrationDirectory, resolveMigrationDirectory, stripSqlNoise } from '@stacksjs/database'
import { resultFailed } from '../result'

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
  const lockDir = frameworkRuntimePath()
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
 * Bootstrap the database once, in the parent process, before any command that
 * needs one touches the server.
 *
 * `migrate` reaches the database from several independent places (the auth
 * tables, the notification tables, the RBAC tables, and the numbered
 * migrations in the action subprocess). Each one used to discover a missing or
 * unreachable database on its own and report it separately, so a single root
 * cause produced a wall of near-identical errors with no obvious first line.
 * Doing it here means the user gets exactly one message, and it arrives before
 * anything destructive is attempted.
 *
 * Fatal by design: there is nothing useful any of those steps can do without a
 * database, and continuing only buries the real reason.
 */
async function ensureDatabaseOrExit(): Promise<void> {
  try {
    const { ensureDatabaseReady } = await import('@stacksjs/database')
    await ensureDatabaseReady()
  }
  catch (error) {
    // syncError, not the async log.error: process.exit fires before an async
    // logger flushes, which would exit 1 with no message at all.
    log.syncError(error instanceof Error ? error.message : String(error))
    process.exit(ExitCode.FatalError)
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
  const file = frameworkRuntimePath('last-migrate-result.json')
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
 * Refuse to replay a migration corpus against a database it was not written
 * for.
 *
 * Stacks ships ONE set of migration files under `database/migrations`, emitted
 * for a single dialect, and `buddy new` copies them verbatim into every new
 * project. Setting DB_CONNECTION=postgres therefore used to fail with a raw
 * `syntax error at or near "AUTOINCREMENT"` on file 1 of 121, which says
 * nothing about the actual cause.
 *
 * Checked in the parent, before the migrate:fresh drop confirmation and before
 * any action subprocess starts, so a mismatch cannot drop the framework tables
 * and only then discover it has nothing to rebuild them with.
 */
export function validateMigrationDialect(cwd = process.cwd()): { valid: boolean, error?: string } {
  const driver = String(process.env.DB_CONNECTION || 'sqlite').toLowerCase()
  const dir = resolveMigrationDirectory(driver, { cwd })
  const relativeDir = relativeMigrationDirectory(dir, cwd)

  // Check 1: is this corpus written for a different DATABASE?
  //
  // Every MySQL-wire dialect (singlestore, vitess) shares MySQL's syntax, so
  // they collapse onto the mysql marker set. Anything without a SQL migration
  // target (dynamodb, browser) resolves to neither branch and is skipped.
  if (process.env[DIALECT_OVERRIDE_ENV] !== '1') {
    const caps = dialectCapabilities(driver)
    const target = caps.wire === 'mysql' ? 'mysql' : caps.wire === 'postgres' ? 'postgres' : 'sqlite'
    if (driver === 'sqlite' || driver === 'postgres' || caps.wire === 'mysql') {
      const audit = auditMigrationCorpus({ dir, target })
      if (!audit.empty && audit.incompatible.length > 0)
        return { valid: false, error: formatMigrationDialectError(audit, target, relativeDir) }
    }
  }

  // Check 2: does this corpus use a FEATURE the engine does not implement?
  //
  // Distinct from check 1 and invisible to it. `FOREIGN KEY` is valid MySQL
  // syntax, so a MySQL corpus pointed at Vitess or SingleStore passes the
  // dialect audit cleanly and then fails mid-migration on the first
  // constraint, with tables already created.
  if (process.env[DDL_CONSTRAINT_OVERRIDE_ENV] !== '1') {
    const constraints = auditDdlConstraints({ dir, dialect: driver })
    if (!constraints.empty && constraints.violations.length > 0)
      return { valid: false, error: formatDdlConstraintError(constraints, driver, relativeDir) }
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
      + `The model-backed create migrations may be stale for this database — run \`./buddy migrate:fresh\` to regenerate and replay them from the model attributes (this resets data).`,
    )
  }
  catch (err) {
    log.debug(`[migrate] FK integrity check skipped: ${err instanceof Error ? err.message : String(err)}`)
  }
}

/**
 * Post-migrate orphan-row scan (stacksjs/stacks#1951, follow-up from #1957).
 *
 * SQLite now boots with `foreign_keys = ON`, so a database written under the
 * old `foreign_keys = OFF` default can carry child rows pointing at parents
 * that no longer exist. Those orphans turn previously-working deletes/inserts
 * into runtime FK failures. `buddy doctor` already surfaces them, but migrate
 * is the highest-context moment — it's the step that first flips enforcement on
 * against the legacy data — so warn here too. Read-only (`PRAGMA
 * foreign_key_check`) and non-fatal: a failed scan must never break migrate,
 * and we never delete data (the operator cleans up manually).
 */
async function reportFkOrphans(): Promise<void> {
  try {
    const { findFkOrphans } = await import('@stacksjs/database')
    const result = await findFkOrphans()
    if (!result.supported || result.total === 0) return

    const sample = result.orphans
      .slice(0, 5)
      .map(o => `  • ${o.table}.${o.column} → ${o.parent} (${o.count} row${o.count === 1 ? '' : 's'})`)
      .join('\n')
    const more = result.orphans.length > 5 ? `\n  + ${result.orphans.length - 5} more — run \`./buddy doctor\` for the full list.` : ''
    const first = result.orphans[0]!
    log.warn(
      `${result.total} row${result.total === 1 ? '' : 's'} violate foreign keys (orphaned parents), now that SQLite enforces \`foreign_keys = ON\`:\n${sample}${more}\n`
      + `These were written under the old \`foreign_keys = OFF\` default (#1951). Review and clean up manually — e.g. `
      + `DELETE FROM ${first.table} WHERE ${first.column} IS NOT NULL AND ${first.column} NOT IN (SELECT id FROM ${first.parent}). migrate never deletes data.`,
    )
  }
  catch (err) {
    log.debug(`[migrate] FK orphan scan skipped: ${err instanceof Error ? err.message : String(err)}`)
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

type FreshGuard = 'allow' | 'confirm' | 'disabled'

interface MigrationGuards {
  confirmMigrate: boolean
  migrateFresh: FreshGuard
}

/** Coerce an env string like "0"/"false"/"no" to a boolean, else undefined. */
function parseGuardBool(raw: string | undefined): boolean | undefined {
  if (raw == null || raw === '') return undefined
  const v = raw.toLowerCase().trim()
  if (v === '1' || v === 'true' || v === 'yes' || v === 'on') return true
  if (v === '0' || v === 'false' || v === 'no' || v === 'off') return false
  return undefined
}

function parseFreshGuard(raw: string | undefined): FreshGuard | undefined {
  const v = raw?.toLowerCase().trim()
  return v === 'allow' || v === 'confirm' || v === 'disabled' ? v : undefined
}

/**
 * Resolve the effective migration safety guards. Precedence (highest first):
 *   1. env var override (DB_MIGRATE_CONFIRM / DB_MIGRATE_FRESH) — the CI escape hatch
 *   2. config/database.ts `safety` block
 *   3. built-in default (confirm on; migrate:fresh disabled in prod, allow elsewhere)
 *
 * Config is read via `awaitConfig()` so the user's `config/database.ts` has
 * definitely merged over the framework defaults before we look. A failure to
 * load config falls back to the safe built-in defaults rather than throwing —
 * a broken config must not turn the guards off.
 */
async function resolveMigrationGuards(): Promise<MigrationGuards> {
  const isProd = /^prod/i.test(process.env.APP_ENV || 'local')

  let cfg: { confirmMigrate?: boolean, migrateFresh?: FreshGuard } = {}
  try {
    const { awaitConfig } = await import('@stacksjs/config')
    const resolved = await awaitConfig()
    cfg = (resolved.database as { safety?: typeof cfg })?.safety ?? {}
  }
  catch (error) {
    log.debug(`[migrate] safety config unavailable, using defaults: ${error instanceof Error ? error.message : String(error)}`)
  }

  const confirmMigrate = parseGuardBool(process.env.DB_MIGRATE_CONFIRM)
    ?? cfg.confirmMigrate
    ?? true

  const migrateFresh = parseFreshGuard(process.env.DB_MIGRATE_FRESH)
    ?? cfg.migrateFresh
    ?? (isProd ? 'disabled' : 'allow')

  return { confirmMigrate, migrateFresh }
}

/** Human-friendly label for the database `migrate:fresh` is about to drop. */
function currentDatabaseLabel(): string {
  const driver = (process.env.DB_CONNECTION || 'sqlite').toLowerCase()
  if (driver === 'sqlite')
    return process.env.DB_DATABASE_PATH || 'database/stacks.sqlite'
  return process.env.DB_DATABASE || 'stacks'
}

export function migrate(buddy: CLI): void {
  const descriptions = {
    migrate: 'Migrates your database',
    fresh: 'Drop all tables and re-run every migration (destroys all data)',
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
    .option('--create-database', 'Create the database if it does not exist, without asking', { default: false })
    .option('--from-db', descriptions.fromDb, { default: false })
    .option('--no-rename', descriptions.noRename)
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: MigrateOptions & { auth?: boolean, createDatabase?: boolean, force?: boolean, fromDb?: boolean, rename?: boolean }) => {
      log.debug('Running `buddy migrate` ...', options)

      const perf = await intro('buddy migrate')

      // Validate models exist before running migrations
      const validation = validateModelsExist()
      if (!validation.valid) {
        console.error(`\n❌ Error: ${validation.error!}\n`)
        process.exit(ExitCode.FatalError)
      }

      // Before the drop confirmation, the database bootstrap, and the action
      // subprocess: a corpus that cannot run must not get as far as dropping
      // tables it has no way to recreate.
      const dialectCheck = validateMigrationDialect()
      if (!dialectCheck.valid) {
        console.error(`\n❌ Error: ${dialectCheck.error!}\n`)
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
          // await: guarantee the error flushes before the outro + exit below.
          await log.error('Failed to preview migrations:', error)
        }
        await outro('Diff complete — no changes applied.', { startTime: perf, useSeconds: true })
        process.exit(ExitCode.Success)
      }

      // Ask about a missing database FIRST, while we still have the terminal.
      // Must happen in the parent: the migrate action runs in a subprocess
      // sharing this stdin, so a prompt down there can hang unseen. Ordered
      // ahead of the confirmMigrate guard below so a first run reads
      // "create it?" then "migrate into it?", rather than asking permission
      // to migrate against a database that does not exist yet. Placed after
      // the --diff branch above, which previews and exits: a dry run must
      // never provision infrastructure.
      await preflightDatabase({ createDatabase: options.createDatabase, command: 'migrate' })

      // Safety guard: confirm before touching the database at all. This is
      // separate from (and runs before) the destructive-change gate below —
      // it catches "wrong database / wrong env" mistakes even for additive
      // migrations. `--force` bypasses it, and non-interactive runs (CI /
      // no TTY) proceed automatically so deploy pipelines aren't blocked.
      const guards = await resolveMigrationGuards()
      if (guards.confirmMigrate && !options.force) {
        if (isCI || !hasTTY) {
          log.debug('[migrate] confirmMigrate guard skipped — non-interactive environment.')
        }
        else {
          const APP_ENV = process.env.APP_ENV || 'local'
          // Flush buffered async logs (e.g. the intro banner) so they paint
          // before this prompt instead of under it (see migrate:fresh below).
          await log.flush()
          const proceed = await confirm({
            message: `Run migrations against the ${APP_ENV} database "${currentDatabaseLabel()}"?`,
            initial: true,
          })
          if (!proceed) {
            await outro('Migration cancelled — no changes applied.', { startTime: perf, useSeconds: true })
            process.exit(ExitCode.Success)
          }
        }
      }

      await ensureDatabaseOrExit()

      // Acquire a project-local migration lock to prevent two concurrent
      // runs from interleaving DDL on the same database. Two parallel
      // `buddy migrate` invocations on the same project used to corrupt
      // the migration table by both inserting the same row name.
      const lock = acquireMigrationLock()
      if (!lock.acquired) {
        // syncError, not the async log.error: process.exit below fires before
        // an async logger flushes, so an async call would exit 1 with no
        // message — leaving a stale lockfile looking like a silent crash.
        log.syncError('Another migration is already running (storage/framework/runtime/migrations.lock exists). Wait for it to finish, or remove the lockfile if it is stale.')
        process.exit(ExitCode.FatalError)
      }

      // Gate destructive changes (drop column/table, lossy type change) behind
      // confirmation while we still have the interactive TTY — the migrate
      // action runs in a non-interactive subprocess.
      const proceed = await confirmDestructiveMigrations({ force: options.force, fromDb: options.fromDb, applyRenames })
      if (!proceed) {
        lock.release()
        await outro('Migration cancelled — no changes applied.', { startTime: perf, useSeconds: true })
        // An operator declining an interactive prompt is a successful cancel.
        // A non-interactive refusal is a failed deployment precondition and
        // must propagate a non-zero status to systemd/ts-cloud.
        process.exit(isCI || !hasTTY ? ExitCode.FatalError : ExitCode.Success)
      }

      // Auth/oauth tables migrate by default, and run BEFORE the numbered
      // model migrations (not after — see stacksjs/stacks#1952 for why this
      // used to run last). Migration
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

      const result = await runAction(Action.Migrate, options).finally(() => lock.release())

      if (resultFailed(result)) {
        log.error('Model migrations failed — applying notification/RBAC table guarantees before exiting.')
      }

      // Notification, RBAC, and polymorphic-trait guarantees run AFTER model
      // migrations so an app model with the same table name remains
      // authoritative. In particular,
      // pre-creating `notification_preferences` used to suppress the generated
      // model migration and silently discard its user_id foreign key. These
      // guarantees are still attempted before the failure exit below (#1952).
      if (options.auth !== false) {
        try {
          const { ensureUtcDatetimeColumns, migrateNotificationTables, migrateRbacTables, migrateTraitTables } = await import('@stacksjs/database')
          const notifResult = await migrateNotificationTables({ verbose: options.verbose })
          if (!notifResult.success) {
            log.error(`Failed to migrate notification tables: ${notifResult.error}`)
          }

          const rbacResult = await migrateRbacTables({ verbose: options.verbose })
          if (!rbacResult.success) {
            log.error(`Failed to migrate RBAC tables: ${rbacResult.error}`)
          }

          const traitResult = await migrateTraitTables({ verbose: options.verbose })
          if (!traitResult.success) {
            log.error(`Failed to migrate polymorphic trait tables: ${traitResult.error}`)
          }

          // MySQL TIMESTAMP columns convert through the session timezone;
          // repair any left over from before the tables declared DATETIME.
          const datetimeResult = await ensureUtcDatetimeColumns({ verbose: options.verbose })
          if (!datetimeResult.success) {
            log.error(`Failed to convert TIMESTAMP columns to DATETIME: ${datetimeResult.error}`)
          }
        }
        catch (error) {
          log.error('Failed to migrate notification/RBAC/trait tables:', error)
        }
      }

      // Surface the model-migration failure only after the guarantee
      // tables above have had their chance to run (#1952).
      if (resultFailed(result)) {
        await outro(
          'While running the migrate command, there was an issue',
          { startTime: perf, useSeconds: true },
          result.error,
        )
        process.exit(ExitCode.FatalError)
      }

      // `users` doesn't exist yet when migrateAuthTables() runs above
      // (that step intentionally runs BEFORE model migrations — other
      // numbered migrations reference oauth_access_tokens, see #1952)
      // — so its users.* guarantee-column ALTERs (email_verified_at,
      // password_changed_at, two_factor_secret, two_factor_enabled) all
      // fail harmlessly against a table that isn't there yet. Run them
      // again now that the numbered migration creating `users` has had
      // its chance. Only when a project's model migrations actually run
      // `users` through (still gated behind --auth, same flag as above).
      if (options.auth !== false) {
        try {
          const { ensureUsersAuthColumns, sqlHelpers } = await import('@stacksjs/database')
          const driver = process.env.DB_CONNECTION || 'sqlite'
          await ensureUsersAuthColumns(sqlHelpers(driver), { verbose: options.verbose })
        }
        catch (error) {
          log.error('Failed to ensure users auth columns post-migration:', error)
        }
      }

      // uuid guarantee — every model with `useUuid: true` needs a `uuid`
      // column, but most committed create-table migrations were generated
      // before the trait was added to their model (or predate the model
      // entirely) and nothing ever regenerates them (stacksjs/status#1
      // Phase 9, see uuid-columns.ts). Unlike the block above this isn't
      // gated behind --auth: the affected models span the whole app, not
      // just `users`.
      try {
        const { ensureUuidColumns, sqlHelpers } = await import('@stacksjs/database')
        const driver = process.env.DB_CONNECTION || 'sqlite'
        await ensureUuidColumns(sqlHelpers(driver), { verbose: options.verbose })
      }
      catch (error) {
        log.error('Failed to ensure uuid columns post-migration:', error)
      }

      // Post-migrate FK integrity check (stacksjs/stacks#1915 D-5).
      // Surfaces the "you flipped DB_CONNECTION and the FKs didn't
      // follow" failure mode while the user is still at the migrate
      // command — the highest-context moment to warn.
      await reportMissingForeignKeys()

      // Post-migrate orphan-row scan (stacksjs/stacks#1951). migrate is the
      // step that flips `foreign_keys = ON` against legacy data, so it's the
      // right place to surface pre-existing orphans (read-only, non-fatal).
      // migrate:fresh rebuilds from scratch, so it can't have orphans — this
      // scan is intentionally only on the plain `migrate` path.
      await reportFkOrphans()

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
    .command('migrate:fresh', descriptions.fresh)
    .alias('db:fresh')
    .option('-d, --diff', 'Show the SQL that would be run', { default: false })
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('-s, --seed', 'Run database seeders after migration', { default: false })
    .option('-a, --auth', descriptions.auth, { default: true })
    .option('--no-auth', 'Skip auth/oauth table migrations')
    .option('--create-database', 'Create the database if it does not exist, without asking', { default: false })
    .option('-f, --force', 'Skip the drop-database confirmation (only honored when the migrateFresh guard is "allow")', { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: MigrateOptions & { seed?: boolean, auth?: boolean, createDatabase?: boolean, force?: boolean }) => {
      log.debug('Running `buddy migrate:fresh` ...', options)

      const perf = await intro('buddy migrate:fresh')

      // Validate models exist before running migrations
      const validation = validateModelsExist()
      if (!validation.valid) {
        console.error(`\n❌ Error: ${validation.error!}\n`)
        process.exit(ExitCode.FatalError)
      }

      // Before the drop confirmation, the database bootstrap, and the action
      // subprocess: a corpus that cannot run must not get as far as dropping
      // tables it has no way to recreate.
      const dialectCheck = validateMigrationDialect()
      if (!dialectCheck.valid) {
        console.error(`\n❌ Error: ${dialectCheck.error!}\n`)
        process.exit(ExitCode.FatalError)
      }

      // Safety guard. migrate:fresh DROPS every table, so it is gated far
      // more strictly than `migrate`: a hard kill-switch plus a typed
      // confirmation that no accidental keystroke can satisfy.
      const guards = await resolveMigrationGuards()
      const dbLabel = currentDatabaseLabel()
      const APP_ENV = process.env.APP_ENV || 'local'

      // Hard kill-switch — the command refuses to run at all.
      if (guards.migrateFresh === 'disabled') {
        // await: this carries the actionable detail (how to re-enable); the
        // outro one-liner below isn't enough on its own, so guarantee it flushes.
        await log.error(
          `\`buddy migrate:fresh\` is disabled by your migration safety guards (it DROPS every table).\n`
          + `  Target: ${APP_ENV} database "${dbLabel}"\n`
          + `  To allow it, set database.safety.migrateFresh to 'allow' in config/database.ts,\n`
          + `  or run once with: DB_MIGRATE_FRESH=allow ./buddy migrate:fresh`,
        )
        await outro('migrate:fresh refused — the migrateFresh guard is set to "disabled".', { startTime: perf, useSeconds: true })
        process.exit(ExitCode.FatalError)
      }

      // Typed confirmation. `--force` bypasses it ONLY when the guard is
      // 'allow'; under 'confirm' a human must always type the name.
      const canBypass = guards.migrateFresh === 'allow' && options.force === true
      if (!canBypass) {
        if (isCI || !hasTTY) {
          const hint = guards.migrateFresh === 'confirm'
            ? 'Guard is "confirm": migrate:fresh must be run interactively.'
            : 'Re-run with --force to drop the database non-interactively.'
          await log.error(`Refusing to drop the ${APP_ENV} database "${dbLabel}" in a non-interactive environment. ${hint}`)
          await outro('migrate:fresh cancelled.', { startTime: perf, useSeconds: true })
          process.exit(ExitCode.FatalError)
        }

        log.warn(`This will DROP ALL TABLES in the ${APP_ENV} database "${dbLabel}" and rebuild them from scratch. All data will be lost.`)
        // Drain buffered async log writes (this warn + the intro banner) so they
        // paint BEFORE the synchronous prompt below. The clarity logger flushes
        // on its own tick, so without this the warning lands *under* clapp's
        // text() prompt and the command looks hung waiting for input.
        await log.flush()
        const typed = await text({ message: `Type the database name "${dbLabel}" to confirm (blank to cancel):` })
        if (typed.trim() !== dbLabel) {
          await outro('migrate:fresh cancelled — confirmation did not match.', { startTime: perf, useSeconds: true })
          process.exit(ExitCode.Success)
        }
      }

      // Bootstrap AFTER the typed confirmation, so cancelling at the prompt
      // cannot leave a freshly provisioned database behind.
      await preflightDatabase({ createDatabase: options.createDatabase, command: 'migrate:fresh' })
      await ensureDatabaseOrExit()

      const result = await runAction(Action.MigrateFresh, options)

      if (resultFailed(result)) {
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
          const { migrateAuthTables, migrateNotificationTables, migrateRbacTables, migrateTraitTables } = await import('@stacksjs/database')
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

          // Polymorphic trait tables — commentables/taggables/categorizables
          // and comment upvotes. None has a model, so the model-derived
          // generator never produced them and every trait call hit a
          // missing table.
          const traitResult = await migrateTraitTables({ verbose: options.verbose })
          if (!traitResult.success) {
            log.error(`Failed to migrate polymorphic trait tables: ${traitResult.error}`)
          }
        }
        catch (error) {
          log.error('Failed to migrate auth/notification/RBAC/trait tables:', error)
        }
      }

      // uuid guarantee (stacksjs/status#1 Phase 9, see uuid-columns.ts) —
      // not gated behind --auth, same reasoning as the `buddy migrate` call
      // site above.
      try {
        const { ensureUuidColumns, sqlHelpers } = await import('@stacksjs/database')
        const driver = process.env.DB_CONNECTION || 'sqlite'
        await ensureUuidColumns(sqlHelpers(driver), { verbose: options.verbose })
      }
      catch (error) {
        log.error('Failed to ensure uuid columns post-migration:', error)
      }

      // Surface the model-migration failure only after the guarantee
      // tables above have had their chance to run (#1952).
      if (resultFailed(result)) {
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

      if (resultFailed(result)) {
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
  // DB_CONNECTION between sqlite / mysql / vitess / postgres
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
    .command('migrate:switch <driver>', 'Pre-flight check + plan for switching DB_CONNECTION between sqlite / mysql / vitess / postgres')
    .action(async (driver: string) => {
      log.debug(`Running \`buddy migrate:switch ${driver}\` ...`)
      const perf = await intro('buddy migrate:switch')

      const target = driver.toLowerCase()
      const allowed = new Set(['sqlite', 'mysql', 'vitess', 'postgres'])
      if (!allowed.has(target)) {
        // eslint-disable-next-line no-console
        console.log(`\n  Unknown target driver "${driver}". Allowed: sqlite, mysql, vitess, postgres.\n`)
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
        vitess: ['DB_HOST', 'DB_PORT', 'DB_USERNAME', 'DB_PASSWORD', 'DB_DATABASE'],
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
        const migrationsDir = resolveMigrationDirectory(target)
        if (existsSync(migrationsDir)) {
          const files = readdirSync(migrationsDir).filter(f => f.endsWith('.sql'))
          for (const f of files) {
            // stripSqlNoise first. Matching raw content counted the words
            // inside `-- Skipped: SQLite does not support ALTER TABLE ADD
            // CONSTRAINT`, so this reported 40 foreign-key migrations that are
            // all `SELECT 1;` no-ops. The real count against this corpus is 0,
            // and the plan then told the user to run `./buddy migrate`.
            const content = stripSqlNoise(readFileSync(`${migrationsDir}/${f}`, 'utf-8')).toLowerCase()
            if (/alter\s+table[\s\S]*add\s+constraint/.test(content)) alterCount++
            if (/^\s*create\s+unique\s+index/m.test(content)) uniqueIdxCount++
          }
        }
      }
      catch { /* directory missing — fine */ }

      // The corpus is emitted for ONE dialect, so "switch" is not a thing the
      // shipped migrations can survive. Say so here rather than letting the
      // checklist send the user into `buddy migrate` and a syntax error.
      // Vitess uses MySQL DDL; topology-specific constraints are emitted by
      // its own generator, while the static corpus audit checks MySQL syntax.
      const auditTarget = target === 'vitess' ? 'mysql' : target as 'sqlite' | 'postgres' | 'mysql'
      const switchAudit = auditMigrationCorpus({ dir: resolveMigrationDirectory(target), target: auditTarget })
      const switchBlocked = switchAudit.incompatible.length > 0
      const blockedFiles = new Set(switchAudit.incompatible.map(m => m.file)).size
      const dialectNote = switchBlocked
        ? `\n  ⛔ ${blockedFiles} of ${switchAudit.total} migration files are ${switchAudit.inferred ?? 'another dialect'}-flavoured and will NOT run on ${target}.`
          + `\n     Regenerate them against ${target} before migrating, or this switch will fail on the first file.`
        : ''

      // The plan is rendered with `console.log` (sync, flushes
      // before `process.exit`) rather than `log.info` (async-
      // buffered, can drop on early exit). The `log.*` helpers are
      // great for the long-running migrate command but the wrong
      // tool for this short-lived static report.
      const sqliteFkNote = current === 'sqlite' && alterCount > 0
        ? `\n    (These were skipped on SQLite per stacksjs/stacks#1916 and survive on disk for replay.)`
        : ''
      const boolNote = current === 'sqlite' && (target === 'postgres' || target === 'mysql' || target === 'vitess')
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
  • Existing row data does NOT auto-migrate. Use \`mysqldump\` / \`pg_dump\` (or your own export) to move it.${missingNote}${dialectNote}
  ─────────────────────────────────────────────

  Next steps:
    1. Update .env:  DB_CONNECTION=${target}${envExtras}
    2. (Optional) Export data from the current ${current} database.
    3. ${switchBlocked ? `Regenerate the migration files for ${target} FIRST — \`./buddy migrate\` will refuse until then.` : `Run \`./buddy migrate\` (or \`migrate:fresh\` to start clean).`}
    4. The post-migrate FK audit will report any constraints that didn't replay.
`)

      await outro(`Plan rendered. Re-run after updating .env to actually switch.`, {
        startTime: perf,
        useSeconds: true,
      })
      process.exit(ExitCode.Success)
    })

  // `buddy migrate:regenerate [dialect]` — rebuild the whole migration corpus
  // from the models, for one dialect.
  //
  // Stacks ships ONE corpus and it is emitted for a single dialect, so a
  // project that switches DB_CONNECTION has SQL it cannot run. Translating the
  // committed SQLite DDL was never viable: that emission threw away varchar
  // lengths, numeric scale and every foreign key (40 are `SELECT 1;` stubs).
  // The intent still lives in the models, so this recovers it rather than
  // guessing.
  buddy
    .command('migrate:regenerate [dialect]', 'Rebuild database/migrations from your models for a given dialect')
    .option('--dry-run', 'Show what would change without writing anything', { default: false })
    .option('-f, --force', 'Regenerate even though the database already has migrations recorded', { default: false })
    .option('--replace-unmarked', 'Also delete migrations carrying no @generated marker (pre-marker corpora only)', { default: false })
    .action(async (dialect: string | undefined, options: { dryRun?: boolean, force?: boolean, replaceUnmarked?: boolean }) => {
      const perf = await intro('buddy migrate:regenerate')

      const target = (dialect || process.env.DB_CONNECTION || 'sqlite').toLowerCase()
      const allowed = new Set(['sqlite', 'mysql', 'vitess', 'postgres', 'singlestore'])
      if (!allowed.has(target)) {
        log.syncError(`Unknown dialect "${target}". Allowed: sqlite, mysql, vitess, postgres, singlestore.`)
        process.exit(ExitCode.FatalError)
      }

      const { countAppliedMigrations, regenerateMigrationCorpus } = await import('@stacksjs/database')

      // Renumbering is safe only against a database with no bookkeeping. The
      // migrations table keys on filename, so renaming files makes applied
      // migrations look pending, and 0000000098 is a hard token wipe.
      let applied = 0
      try { applied = await countAppliedMigrations() }
      catch { applied = 0 }

      if (applied > 0 && !options.force && !options.dryRun) {
        log.syncError(`This database already has ${applied} migration(s) recorded.`)
        log.syncError('Regenerating renumbers every file, and the migrations table keys on the filename,')
        log.syncError('so already-applied migrations would look pending and run a second time.')
        log.syncError('  Point at an empty database, or re-run with --force if you know it is safe.')
        process.exit(ExitCode.FatalError)
      }

      const plan = await regenerateMigrationCorpus({ dialect: target, dryRun: true, replaceUnmarked: options.replaceUnmarked })
      if (resultFailed(plan)) {
        log.syncError(plan.error.message)
        process.exit(ExitCode.FatalError)
      }

      const { files, removed, preserved, preservedOutOfScope, models, modelRoots } = plan.value

      // Preserved files are the ones no rerun can recreate, so they are the
      // only part of this plan a user cannot undo by running the command
      // again. List them by name rather than as a count (stacksjs/stacks#2234),
      // and split the two reasons, because they call for opposite responses:
      // an unmarked file is someone's work, an out-of-scope one is a table this
      // app's models no longer describe (stacksjs/stacks#2255).
      const outOfScope = new Set(preservedOutOfScope)
      const unmarked = preserved.filter(f => !outOfScope.has(f))

      const unmarkedBlock = unmarked.length === 0
        ? ''
        : `
  • ${unmarked.length} file(s) carry no @generated marker and will be KEPT:
${unmarked.map(f => `      ${f}`).join('\n')}
    Hand-authored migrations cannot be regenerated, so they are never deleted.
    If these are output from a Stacks version that predated the marker, re-run
    with --replace-unmarked to replace them too.`

      // Capped, unlike the unmarked list: an app that narrowed its model scope
      // can have seventy of these, and scrolling the confirmation prompt off
      // the screen is its own kind of unreadable.
      const OUT_OF_SCOPE_SHOWN = 20
      const outOfScopeMore = preservedOutOfScope.length - OUT_OF_SCOPE_SHOWN
      const outOfScopeBlock = preservedOutOfScope.length === 0
        ? ''
        : `
  • ${preservedOutOfScope.length} file(s) describe tables this corpus does not rebuild, and will be KEPT:
${preservedOutOfScope.slice(0, OUT_OF_SCOPE_SHOWN).map(f => `      ${f}`).join('\n')}${outOfScopeMore > 0 ? `\n      ... and ${outOfScopeMore} more` : ''}
    Nothing in scope regenerates these, so removing them would leave the app
    with no definition for those tables at all. If they belong to framework
    models your app relies on without declaring (users, jobs, payments, ...),
    either publish them with \`buddy publish model <Name>\` or set
    database.models.includeFrameworkDefaults, then regenerate again.`

      // The roots that actually contributed. Saying "app/Models and the
      // framework defaults" unconditionally was wrong for every app that has
      // models of its own (stacksjs/stacks#2255).
      const rootList = modelRoots.length === 0
        ? 'no model directory'
        : modelRoots.map(root => relative(process.cwd(), root) || root).join(' and ')

      // eslint-disable-next-line no-console
      console.log(`
  Regenerate plan: ${target}
  ─────────────────────────────────────────────
  • ${models} model(s) read from ${rootList}
  • ${files.length} migration file(s) will be written
  • ${removed.length} existing file(s) will be removed${unmarkedBlock}${outOfScopeBlock}
  • These files are tracked in git, so review with \`git diff\` afterwards
  ─────────────────────────────────────────────
`)

      if (options.dryRun) {
        await outro('Dry run. Nothing was written.', { startTime: perf, useSeconds: true })
        process.exit(ExitCode.Success)
      }

      if (!isCI && hasTTY && process.stdin.isTTY) {
        await log.flush()
        const proceed = await confirm({ message: `Replace ${removed.length} migration file(s) with ${files.length} generated for ${target}?`, initial: false })
        if (!proceed) {
          await outro('Cancelled. Nothing was written.', { startTime: perf, useSeconds: true })
          process.exit(ExitCode.Success)
        }
      }

      const result = await regenerateMigrationCorpus({ dialect: target, replaceUnmarked: options.replaceUnmarked })
      if (resultFailed(result)) {
        log.syncError(result.error.message)
        process.exit(ExitCode.FatalError)
      }

      log.success(`Wrote ${result.value.files.length} ${target} migration file(s) to database/migrations.`)

      // Regeneration just renumbered every file, and the ledger keys on the
      // filename — so without this, every migration this database had already
      // applied now reads as pending and re-runs on the next `migrate`
      // (stacksjs/stacks#2203). Reconciling is only reachable here after the
      // guard above, i.e. an empty ledger or an explicit --force, and it is
      // strictly safer than leaving the rows pointing at files that no longer
      // exist.
      if (applied > 0) {
        const { reconcileMigrationLedger } = await import('@stacksjs/database')
        const fixed = await reconcileMigrationLedger()
        if (fixed.remapped.length > 0)
          log.info(`Repointed ${fixed.remapped.length} ledger row(s) at their renumbered file.`)
        if (fixed.recorded.length > 0)
          log.info(`Recorded ${fixed.recorded.length} migration(s) already present in the schema.`)
        if (fixed.skipped.length > 0) {
          log.warn(`${fixed.skipped.length} ledger entr(ies) need a look — run \`./buddy migrate:status\`.`)
        }
      }

      log.info('Review the change with `git diff`, then run `./buddy migrate`.')
      await outro('Regenerated.', { startTime: perf, useSeconds: true })
      process.exit(ExitCode.Success)
    })

  // `buddy migrate:status` — compare the corpus on disk, the `migrations`
  // ledger, and the live schema.
  //
  // The ledger alone cannot be trusted to describe itself: it keys on the
  // filename, regeneration renumbers files, and a renumbered migration then
  // reads as pending forever. In the reported case (stacksjs/stacks#2203) the
  // ledger claimed 6 applied while the schema reflected 22, and the first
  // symptom was a 500 from an unrelated feature weeks later. Reading the schema
  // is what tells "applied, row lost" apart from "genuinely never ran".
  buddy
    .command('migrate:status', 'Compare database/migrations, the migrations ledger, and the live schema')
    .option('--reconcile', 'Repair the ledger where the schema proves what happened', { default: false })
    .option('--include-partial', 'With --reconcile, also record half-applied migrations', { default: false })
    .option('--json', 'Emit the audit as JSON', { default: false })
    .action(async (options: { reconcile?: boolean, includePartial?: boolean, json?: boolean }) => {
      const perf = options.json ? undefined : await intro('buddy migrate:status')

      const { auditMigrationLedger, reconcileMigrationLedger } = await import('@stacksjs/database')
      const audit = await auditMigrationLedger()

      if (options.json) {
        // eslint-disable-next-line no-console
        console.log(JSON.stringify(audit, (_k, v) => (v instanceof Set ? [...v] : v), 2))
        process.exit(audit.drift ? ExitCode.FatalError : ExitCode.Success)
      }

      if (!audit.supported) {
        log.info(`Dialect "${audit.dialect}" is not audited. Nothing to compare.`)
        await outro('Skipped.', { startTime: perf!, useSeconds: true })
        process.exit(ExitCode.Success)
      }

      const { counts, entries, orphans } = audit
      const list = (status: string): string[] => entries.filter(e => e.status === status).map(e => e.file)

      // One buffer, one write. `log.*` is async and `console.log` is not, so
      // interleaving them detaches every heading from the list it introduces.
      const report: string[] = []
      const section = (heading: string, files: string[]): void => {
        if (files.length === 0) return
        if (heading) report.push(`  ${heading}`)
        for (const file of files.slice(0, 8)) report.push(`      ${file}`)
        if (files.length > 8) report.push(`      … +${files.length - 8} more`)
        report.push('')
      }

      report.push('')
      report.push(`  Migration status: ${audit.dialect}`)
      report.push('  ─────────────────────────────────────────────')
      report.push(`  ${entries.length} file(s) on disk · ${audit.recordedCount} recorded in the ledger`)
      report.push('')

      if (counts.applied > 0)
        report.push(`  ${counts.applied} applied - recorded, and present in the schema.`, '')
      if (counts.unverifiable > 0)
        report.push(`  ${counts.unverifiable} unverifiable - data migrations with no schema trace to check.`, '')

      section(`${counts.pending} pending - not applied yet, will run on the next \`buddy migrate\`:`, list('pending'))
      if (counts.stranded > 0) {
        report.push(`  ${counts.stranded} STRANDED - already applied to the schema, but missing from the ledger.`)
        report.push('  These re-run on the next `buddy migrate`, which is unsafe for anything not idempotent.')
        section('', list('stranded'))
      }
      section(`${counts.partial} PARTIAL - some effects present, some missing. Needs a human:`, list('partial'))
      section(`${counts.reverted} REVERTED - recorded as applied, but the effects are gone from the schema:`, list('reverted'))

      if (orphans.length > 0) {
        section(
          `${orphans.length} orphaned ledger row(s) - recorded, but no such file on disk:`,
          orphans.map(o => `${o.migration}${o.renamedTo ? `  -> renumbered to ${o.renamedTo}` : '  (no counterpart; migration deleted?)'}`),
        )
      }

      // eslint-disable-next-line no-console
      console.log(report.join('\n'))

      if (!audit.drift) {
        await outro('Ledger matches the corpus and the schema.', { startTime: perf!, useSeconds: true })
        process.exit(ExitCode.Success)
      }

      if (!options.reconcile) {
        // eslint-disable-next-line no-console
        console.log(`
  Repair with:  ./buddy migrate:status --reconcile
  That repoints renumbered ledger rows and records migrations the schema
  already proves. It never runs SQL from a migration file.
`)
        await outro('Drift detected.', { startTime: perf!, useSeconds: true })
        process.exit(ExitCode.FatalError)
      }

      const fixed = await reconcileMigrationLedger({ includePartial: options.includePartial })
      if (fixed.remapped.length > 0)
        log.success(`Repointed ${fixed.remapped.length} ledger row(s) at their renumbered file.`)
      if (fixed.recorded.length > 0)
        log.success(`Recorded ${fixed.recorded.length} migration(s) the schema already reflects.`)
      if (fixed.skipped.length > 0) {
        log.warn(`Left ${fixed.skipped.length} entr(ies) alone:`)
        // eslint-disable-next-line no-console
        console.log(fixed.skipped.slice(0, 8).map(s => `      ${s.file} — ${s.reason}`).join('\n')
          + (fixed.skipped.length > 8 ? `\n      … +${fixed.skipped.length - 8} more` : ''))
      }
      if (fixed.remapped.length === 0 && fixed.recorded.length === 0)
        log.info('Nothing could be repaired automatically.')

      await outro('Reconciled.', { startTime: perf!, useSeconds: true })
      process.exit(ExitCode.Success)
    })

  onUnknownSubcommand(buddy, "migrate")
}
