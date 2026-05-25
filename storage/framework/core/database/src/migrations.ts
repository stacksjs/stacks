/**
 * Database Migrations using bun-query-builder
 *
 * This module provides migration functionality for the stacks framework
 * powered by bun-query-builder.
 */

import type { Result } from '@stacksjs/error-handling'
import { existsSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { log as _log } from '@stacksjs/logging'

// Defensive log wrapper to handle cases where log methods might not be initialized.
// Without `error` here, the catch block at runDatabaseMigration() throws
// "log.error is not a function", which masked the underlying migration error
// in the dev-server output.
const log = {
  info: (...args: any[]) => typeof _log?.info === 'function' ? (_log.info as (...a: any[]) => void)(...args) : console.log(...args),
  success: (msg: string) => typeof _log?.success === 'function' ? _log.success(msg) : console.log(msg),
  warn: (msg: string) => typeof _log?.warn === 'function' ? _log.warn(msg) : console.warn(msg),
  error: (...args: any[]) => typeof _log?.error === 'function' ? (_log.error as (...a: any[]) => void)(...args) : console.error(...args),
  debug: (...args: any[]) => typeof _log?.debug === 'function' ? (_log.debug as (...a: any[]) => void)(...args) : console.debug(...args),
}
import { err, handleError, ok } from '@stacksjs/error-handling'
import { path } from '@stacksjs/path'
import {
  createQueryBuilder,
  executeMigration as qbExecuteMigration,
  generateMigration as qbGenerateMigration,
  resetConnection,
  resetDatabase as qbResetDatabase,
  setConfig,
} from '@stacksjs/query-builder'
import { db } from './utils'
import { acquireMigrationLock } from './migration-lock'

// Use environment variables via @stacksjs/env for proper type coercion
import { env as envVars } from '@stacksjs/env'
import { getConnectionDefaults } from './defaults'

// Build database config from environment variables
const dbDriver = envVars.DB_CONNECTION || 'sqlite'
const sqliteDefaults = getConnectionDefaults('sqlite', envVars)
const mysqlDefaults = getConnectionDefaults('mysql', envVars)
const postgresDefaults = getConnectionDefaults('postgres', envVars)

const dbConfig = {
  default: dbDriver,
  connections: {
    sqlite: { database: sqliteDefaults.database, prefix: '' },
    mysql: { name: mysqlDefaults.database, host: mysqlDefaults.host, username: mysqlDefaults.username, password: mysqlDefaults.password, port: mysqlDefaults.port, prefix: '' },
    postgres: { name: postgresDefaults.database, host: postgresDefaults.host, username: postgresDefaults.username, password: postgresDefaults.password, port: postgresDefaults.port, prefix: '' },
  },
}

function getDriver(): string {
  return dbConfig.default || 'sqlite'
}

/**
 * Narrow `DB_CONNECTION` to a SQL dialect the migration runner and
 * bun-query-builder can actually execute against. Previously this
 * silently fell back to `'sqlite'` for any unrecognized driver —
 * including `'dynamodb'`, which was advertised in env types and config
 * validators but has no working SQL path. Result: `DB_CONNECTION=dynamodb`
 * would silently run SQLite migrations against a non-existent file
 * (stacksjs/stacks#1876 D-4).
 *
 * Now: throw with a clear pointer. Apps that genuinely want DynamoDB
 * should use the entity-style `dynamo.entity(...)` API directly
 * instead of the SQL ORM/migration path.
 */
function getDialect(): 'sqlite' | 'mysql' | 'postgres' {
  const driver = getDriver()
  if (driver === 'sqlite' || driver === 'mysql' || driver === 'postgres') return driver
  if (driver === 'dynamodb') {
    throw new Error(
      '[database] DB_CONNECTION=dynamodb is not compatible with the SQL migration runner. '
      + 'DynamoDB has no schema-migration concept — use the entity-style `dynamo.entity(...)` '
      + 'API from @stacksjs/database directly. To run SQL migrations, set DB_CONNECTION to one of: sqlite, mysql, postgres.',
    )
  }
  throw new Error(
    `[database] Unknown DB_CONNECTION "${driver}". Allowed values: sqlite, mysql, postgres, dynamodb.`,
  )
}

/**
 * Configure bun-query-builder with stacks database settings
 */
function configureQueryBuilder(): void {
  const dialect = getDialect()
  const connectionConfig = dbConfig.connections[dialect] as any

  setConfig({
    dialect,
    // bun-query-builder defaults to `verbose: true`, which dumps an
    // unconditional wall of `-- Comparing with stored snapshot`,
    // `-- Found N script files`, `-- Migrations table ready` etc. to
    // stdout on every `buddy migrate` (including no-op re-runs). Stacks
    // surfaces its own progress via the buddy CLI's intro/outro pair,
    // so silence the library chatter by default. Users can flip this
    // back via `setConfig({ verbose: true })` from their own config or
    // by exporting `STACKS_QB_VERBOSE=1` (intentionally not wired yet —
    // add it if a real debugging need shows up).
    verbose: false,
    database: {
      database: connectionConfig?.name || connectionConfig?.database || 'stacks',
      host: connectionConfig?.host || 'localhost',
      port: connectionConfig?.port || (dialect === 'postgres' ? 5432 : dialect === 'mysql' ? 3306 : 0),
      username: connectionConfig?.username || '',
      password: connectionConfig?.password || '',
    },
  })

  // Reset the connection to ensure the new config is used
  resetConnection()
}

function prepareMigrationModelsDir(): { modelsDir: string, skip: boolean } {
  const userModelsDir = path.userModelsPath()
  return { modelsDir: userModelsDir, skip: !existsSync(userModelsDir) }
}

/**
 * SQLite compatibility preprocessing for migrations.
 *
 * SQLite does not support:
 * - ALTER TABLE ADD CONSTRAINT (foreign keys must be defined at table creation)
 * - Creating duplicate unique indexes on columns that already have UNIQUE constraints
 *   from inline table definitions (the index name differs but the constraint conflicts)
 *
 * Files that would become no-ops are deleted from disk and recorded in the
 * migrations tracking table so they're treated as "executed" — keeping the
 * migrations/ directory clean instead of cluttered with `SELECT 1` stubs.
 */
function preprocessSqliteMigrations(): void {
  const migrationsDir = join(process.cwd(), 'database', 'migrations')
  let files: string[]
  try {
    files = readdirSync(migrationsDir).filter(f => f.endsWith('.sql'))
  }
  catch {
    return // directory doesn't exist yet
  }

  // Track which migrations we drop so we can mark them executed in the
  // migrations table (otherwise the next generate run regenerates them).
  const droppedMigrations: string[] = []
  const dropMigration = (file: string, filePath: string, reason: string): void => {
    log.info(`Dropping no-op migration (${reason}): ${file}`)
    try { unlinkSync(filePath) }
    catch { /* already gone */ }
    droppedMigrations.push(file)
  }

  const addConstraintPattern = /^\s*ALTER\s+TABLE\s+.+\s+ADD\s+CONSTRAINT\s+/i
  // Match CREATE UNIQUE INDEX — these are redundant in SQLite when the table
  // already defines the UNIQUE constraint inline during CREATE TABLE.
  // Regular CREATE INDEX is fine and should NOT be skipped.
  const createUniqueIndexPattern = /^\s*CREATE\s+UNIQUE\s+INDEX\s+/i
  // Match ALTER TABLE ... DROP COLUMN — SQLite fails if the column doesn't exist
  const dropColumnPattern = /^\s*ALTER\s+TABLE\s+["']?(\w+)["']?\s+DROP\s+COLUMN\s+["']?(\w+)["']?\s*$/i
  // Match CREATE TABLE — used to detect when buddy regenerates a CREATE TABLE
  // migration for a table that already has an earlier create-table file.
  const createTablePattern = /^\s*CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["']?(\w+)["']?/i

  // First pass: index every "create-<table>-table.sql" by table name. The
  // earliest (lowest-timestamp) wins. Anything later for the same table is
  // a duplicate from buddy regenerating migrations for an already-modeled
  // table — drop those instead of cluttering the directory.
  const createTableEarliest = new Map<string, string>()
  for (const file of files) {
    const m = file.match(/^\d+-create-(\w+)-table\.sql$/)
    if (!m || !m[1]) continue
    const tableName = m[1]
    const existing = createTableEarliest.get(tableName)
    if (!existing || file < existing) createTableEarliest.set(tableName, file)
  }

  // Open SQLite DB to check column existence for DROP COLUMN migrations
  const sqliteDbPath = join(process.cwd(), dbConfig.connections.sqlite.database || 'stacks.db')
  let sqliteDb: import('bun:sqlite').Database | null = null
  if (existsSync(sqliteDbPath)) {
    try {
      const { Database } = require('bun:sqlite')
      sqliteDb = new Database(sqliteDbPath, { readonly: true })
    }
    catch {
      // If we can't open the DB, we'll skip DROP COLUMN checks
    }
  }

  for (const file of files) {
    log.debug(`[migration] Running: ${file}`)
    const filePath = join(migrationsDir, file)
    const content = readFileSync(filePath, 'utf-8')
    const statements = content
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))

    if (statements.length === 0) continue

    // Drop duplicate CREATE TABLE migrations — keep only the earliest one
    // for each table. This handles the case where buddy regenerates a
    // create-table migration for a table that's already modeled.
    const firstStatement = statements[0]
    const createTableMatch = firstStatement ? firstStatement.match(createTablePattern) : null
    if (createTableMatch && createTableMatch[1]) {
      const tableName = createTableMatch[1]
      const earliest = createTableEarliest.get(tableName)
      if (earliest && earliest !== file) {
        dropMigration(file, filePath, `duplicate create-table for "${tableName}" (kept ${earliest})`)
        continue
      }
    }

    // Skip files that only contain ALTER TABLE ADD CONSTRAINT
    const allAddConstraint = statements.every(s => addConstraintPattern.test(s))
    if (allAddConstraint) {
      dropMigration(file, filePath, 'SQLite does not support ALTER TABLE ADD CONSTRAINT')
      continue
    }

    // CREATE UNIQUE INDEX fails in SQLite when the column already has
    // a UNIQUE constraint from table creation. IF NOT EXISTS only checks
    // by index name, not by column — so a second unique index with a
    // different name triggers SQLITE_CONSTRAINT_UNIQUE.
    const allCreateUniqueIndex = statements.every(s => createUniqueIndexPattern.test(s))
    if (allCreateUniqueIndex) {
      dropMigration(file, filePath, 'unique constraint already inline on table')
      continue
    }

    // DROP COLUMN fails in SQLite if the column doesn't exist (e.g., on fresh DB
    // where the CREATE TABLE already reflects the current model without the column).
    // Filter out DROP COLUMN statements for non-existent columns. Keep all other
    // statements unchanged.
    const hasDropColumn = statements.some(s => dropColumnPattern.test(s))
    if (hasDropColumn) {
      let modified = false
      const filteredStatements: string[] = []

      for (const stmt of statements) {
        const dropColMatch = stmt.match(dropColumnPattern)
        if (dropColMatch && dropColMatch[1] && dropColMatch[2]) {
          const tableName = dropColMatch[1]
          const columnName = dropColMatch[2]

          if (!sqliteDb) {
            // No database file — fresh install. The CREATE TABLE migration will
            // create the table from the current model (without the dropped column),
            // so this DROP COLUMN is unnecessary.
            log.info(`Skipping DROP COLUMN "${columnName}" — no database exists yet: ${file}`)
            modified = true
            continue
          }

          try {
            // Sanitize table name to prevent SQL injection (only allow alphanumeric and underscores)
            const safeTableName = tableName.replace(/[^a-zA-Z0-9_]/g, '')
            const columns = (sqliteDb as any).prepare(`PRAGMA table_info("${safeTableName}")`).all() as Array<{ name: string }>
            if (columns.length === 0) {
              // Table doesn't exist yet — column will be absent from CREATE TABLE
              log.info(`Skipping DROP COLUMN "${columnName}" — table "${tableName}" does not exist yet: ${file}`)
              modified = true
              continue
            }
            const columnExists = columns.some((col: { name: string }) => col.name === columnName)
            if (!columnExists) {
              log.info(`Skipping DROP COLUMN "${columnName}" from "${tableName}" — column does not exist: ${file}`)
              modified = true
              continue
            }
          }
          catch {
            // Table doesn't exist — skip the DROP COLUMN
            log.info(`Skipping DROP COLUMN "${columnName}" — table "${tableName}" not found: ${file}`)
            modified = true
            continue
          }
        }
        filteredStatements.push(stmt)
      }

      if (modified) {
        if (filteredStatements.length === 0) {
          dropMigration(file, filePath, 'columns already absent from table')
        }
        else {
          writeFileSync(filePath, `${filteredStatements.join(';\n')};\n`)
        }
        continue
      }
    }
  }

  if (sqliteDb) {
    try { (sqliteDb as any).close() }
    catch { /* ignore */ }
  }

  // Record dropped migrations as executed so they don't get regenerated on
  // the next `buddy generate:migrations` cycle. Without this, the same
  // unique-index / add-constraint migrations would reappear every run.
  if (droppedMigrations.length > 0) {
    try {
      const dbPath = join(process.cwd(), dbConfig.connections.sqlite.database || 'stacks.db')
      if (existsSync(dbPath)) {
        const { Database } = require('bun:sqlite')
        const writeDb = new Database(dbPath)
        try {
          writeDb.exec(`CREATE TABLE IF NOT EXISTS migrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            migration TEXT NOT NULL UNIQUE,
            executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )`)
          const insert = writeDb.prepare('INSERT OR IGNORE INTO migrations (migration) VALUES (?)')
          for (const migration of droppedMigrations) insert.run(migration)
        }
        finally { writeDb.close() }
      }
    }
    catch (e) {
      log.debug(`[migration] Could not record dropped migrations as executed: ${e}`)
    }
  }
}

/**
 * Ensure the target database exists for PostgreSQL/MySQL.
 * SQLite creates files automatically; server-based databases need an explicit CREATE DATABASE.
 * Uses bun-query-builder's createQueryBuilder + unsafe() to connect to the admin database
 * and issue CREATE DATABASE before switching to the target database for migrations.
 */
async function ensureDatabaseExists(): Promise<void> {
  const dialect = getDialect()

  if (dialect === 'sqlite')
    return

  const connectionConfig = dbConfig.connections[dialect] as any
  const dbName = (connectionConfig?.name || 'stacks').replace(/['"]/g, '')
  const host = connectionConfig?.host || 'localhost'
  const port = connectionConfig?.port || (dialect === 'postgres' ? 5432 : 3306)
  const username = connectionConfig?.username || (dialect === 'postgres' ? process.env.USER || 'postgres' : 'root')
  const password = connectionConfig?.password || ''

  // The admin database to connect to for CREATE DATABASE
  const adminDatabase = dialect === 'postgres' ? 'postgres' : 'mysql'

  try {
    // Configure bun-query-builder to connect to the admin database
    setConfig({
      dialect,
      database: {
        database: adminDatabase,
        host,
        port,
        username,
        password,
      },
    })
    resetConnection()

    const adminDb = createQueryBuilder()

    if (dialect === 'postgres') {
      try {
        await adminDb.unsafe(`CREATE DATABASE "${dbName}"`)
        log.info(`Created database "${dbName}"`)
      }
      catch (e: any) {
        // 42P04 = database already exists
        if (e?.message?.includes('already exists') || e?.errno === '42P04') {
          log.info(`Database "${dbName}" already exists`)
        }
        else {
          throw e
        }
      }
    }
    else if (dialect === 'mysql') {
      try {
        await adminDb.unsafe(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``)
        log.info(`Ensured database "${dbName}" exists`)
      }
      catch (e: any) {
        if (e?.message?.includes('database exists')) {
          log.info(`Database "${dbName}" already exists`)
        }
        else {
          throw e
        }
      }
    }

    // Reset connection so configureQueryBuilder() can reconnect to the target database
    resetConnection()
  }
  catch (error: any) {
    log.warn(`Could not auto-create database "${dbName}": ${error?.message || error}`)
    log.info('If the database already exists, this warning can be ignored.')
    // Reset connection state regardless of failure
    resetConnection()
  }
}

/**
 * Skip migrations owned by features whose `config.<feature>.enabled` is
 * false (stacksjs/stacks#1854). Pre-flight pass that hides
 * `database/migrations/<owned>.sql` → `<owned>.sql.disabled` for the
 * duration of the run. Restored in a `finally` so a crash mid-migration
 * still leaves the directory clean. Returns the list of paths that
 * were hidden so the caller can log them.
 *
 * Lives here (not in `@stacksjs/buddy`) so the migration runner can
 * import it without a dependency cycle. Stays a no-op when the
 * feature manifest / config can't be resolved — defensive, since the
 * runner is also called from non-CLI contexts (tests, programmatic
 * migrations) where one or the other might not be initialised.
 */
async function hideDisabledFeatureMigrations(): Promise<Array<{ original: string, hidden: string, feature: string }>> {
  const hidden: Array<{ original: string, hidden: string, feature: string }> = []
  try {
    const { FEATURE_NAMES, migrationFeature } = await import('@stacksjs/buddy')
    const { feature: isFeatureEnabled } = await import('@stacksjs/config')
    const fs = await import('node:fs/promises')

    const migrationsDir = path.projectPath('database/migrations')
    if (!existsSync(migrationsDir)) return hidden

    const disabledFeatures = new Set(
      (FEATURE_NAMES as readonly string[]).filter((f: string) => !(isFeatureEnabled as (name: string) => boolean)(f)),
    )
    if (disabledFeatures.size === 0) return hidden

    const files = readdirSync(migrationsDir).filter(f => f.endsWith('.sql'))
    for (const file of files) {
      const owner = (migrationFeature as (filename: string) => string | null)(file)
      if (!owner || !disabledFeatures.has(owner)) continue
      const original = join(migrationsDir, file)
      const hiddenPath = `${original}.disabled`
      await fs.rename(original, hiddenPath)
      hidden.push({ original, hidden: hiddenPath, feature: owner })
    }

    if (hidden.length > 0) {
      const summary = Object.entries(
        hidden.reduce<Record<string, number>>((acc, h) => {
          acc[h.feature] = (acc[h.feature] ?? 0) + 1
          return acc
        }, {}),
      )
        .map(([f, n]) => `${f}: ${n}`)
        .join(', ')
      log.info(`[migration] Skipping ${hidden.length} migration(s) for disabled features (${summary}). Run \`./buddy <feature>:install\` to enable.`)
    }
  }
  catch {
    // `@stacksjs/buddy` / `@stacksjs/config` may not resolve cleanly in
    // every embedding (notably bare tests). The gate is best-effort —
    // a missing manifest doesn't block migrations from running.
  }
  return hidden
}

async function restoreHiddenMigrations(hidden: Array<{ original: string, hidden: string, feature: string }>): Promise<void> {
  const fs = await import('node:fs/promises')
  for (const { original, hidden: h } of hidden) {
    try { await fs.rename(h, original) }
    catch { /* best-effort restore; another invocation may have already swept */ }
  }
}

/**
 * Count how many migrations have been recorded as applied in the
 * `migrations` table. Returns 0 when the table doesn't exist yet
 * (fresh database, first ever migration) — bun-query-builder
 * creates the table during the first `executeMigration` call.
 *
 * Used by {@link runDatabaseMigration} before + after the migration
 * run so the caller can report `applied = afterCount - beforeCount`
 * — distinguishes the "nothing to migrate" path from a real apply
 * in the CLI outro (user-reported messaging gap).
 */
async function countAppliedMigrations(): Promise<number> {
  try {
    const row = await (db as any)
      .selectFrom('migrations')
      .select((eb: any) => eb.fn.count<number>('id').as('n'))
      .executeTakeFirst()
    if (!row) return 0
    const n = Number(row.n ?? row.N ?? 0)
    return Number.isFinite(n) ? n : 0
  }
  catch {
    // Table doesn't exist yet — pre-first-migration state. Treat as
    // zero so a fresh DB shows "applied N" on the first run rather
    // than throwing here and pretending nothing happened.
    return 0
  }
}

/**
 * Persist the last migration outcome for the CLI parent process to
 * pick up. The migrate / migrate:fresh subprocesses run in a forked
 * `bun` invocation and exit only with a status code, so the parent
 * `buddy migrate` command has no in-process way to learn how many
 * migrations actually ran. This marker file is the handoff.
 *
 * Buddy reads + deletes after the subprocess exits. Errors writing
 * the marker are swallowed — the migration itself succeeded; failing
 * to record the count just means the outro falls back to the
 * generic "Migrated your <env> database." message.
 */
async function writeMigrateMarker(appliedCount: number): Promise<void> {
  try {
    const fs = await import('node:fs/promises')
    const dir = path.projectPath('.stacks')
    await fs.mkdir(dir, { recursive: true })
    const file = `${dir}/last-migrate-result.json`
    const body = JSON.stringify({
      appliedCount,
      completedAt: new Date().toISOString(),
    })
    await fs.writeFile(file, body, 'utf8')
  }
  catch {
    // Don't fail the migration because we couldn't write a marker;
    // the buddy CLI's outro will just use its generic fallback.
  }
}

/**
 * Run database migrations
 */
export async function runDatabaseMigration(): Promise<Result<string, Error>> {
  const startedAt = Date.now()
  const hidden = await hideDisabledFeatureMigrations()
  // Lock handle is acquired AFTER ensureDatabaseExists (PG/MySQL need
  // the target DB to exist before we can connect to it for the
  // advisory lock). SQLite is fine to lock immediately.
  let lockHandle: { release: () => Promise<void> } | null = null
  try {
    // Step-progress logs stay at debug. On a no-op run (the common case
    // when the user re-issues `buddy migrate` against a clean DB) we
    // want a clean intro→outro pair from the buddy CLI, not a wall of
    // "Migrating database... / Database migration completed" lines
    // that duplicate what the outro already prints with timing.
    log.debug('Migrating database...')

    // Ensure the database exists before running migrations (PostgreSQL/MySQL)
    await ensureDatabaseExists()

    // Configure bun-query-builder with stacks database settings
    configureQueryBuilder()

    // Acquire the distributed migration lock (stacksjs/stacks#1876 D-1).
    // Without this, two concurrent runners (parallel CI jobs, two app
    // instances on boot) race the migrations table and corrupt state —
    // both read the same "pending" list, both run the same SQL, both
    // try to insert the same record. The lock is advisory on PG/MySQL
    // (auto-released on disconnect) and file-based on SQLite (with a
    // 60s staleness fallback so a crashed holder doesn't block forever).
    const dialect = getDialect()
    const lockDb = dialect === 'sqlite' ? null : createQueryBuilder()
    lockHandle = await acquireMigrationLock(dialect, lockDb)

    // Preprocess migrations for SQLite compatibility — runs *after*
    // the lock is held so concurrent processes can't corrupt each
    // other's disk state (stacksjs/stacks#1876 D-2).
    if (dialect === 'sqlite') {
      preprocessSqliteMigrations()
    }

    const modelsDir = path.userModelsPath()

    // Count applied-before so we can compute the delta after the
    // migration run. Lets the buddy CLI distinguish "nothing to
    // migrate" from "applied N" in the outro (user-reported
    // messaging gap).
    const appliedBefore = await countAppliedMigrations()

    // Execute existing migration files
    log.debug(`[migration] Running migrations from: ${modelsDir}`)
    await qbExecuteMigration(modelsDir)

    const appliedAfter = await countAppliedMigrations()
    const appliedCount = Math.max(0, appliedAfter - appliedBefore)
    await writeMigrateMarker(appliedCount)

    log.debug(`Database migration completed in ${Date.now() - startedAt}ms (applied ${appliedCount}).`)
    return ok(appliedCount === 0
      ? 'Nothing to migrate.'
      : `Applied ${appliedCount} migration${appliedCount === 1 ? '' : 's'}.`)
  }
  catch (error) {
    // Surface enough context for the user to act on the failure: which
    // migration directory, how long it ran before crashing, and the
    // underlying error message. The previous bare "Migration failed"
    // forced everyone to add their own debug logs.
    const detail = error instanceof Error ? error.message : String(error)
    log.error(`[migration] Failed after ${Date.now() - startedAt}ms: ${detail}`)
    log.info('[migration] Run `./buddy migrate:fresh` to drop and recreate the schema if state is partial.')
    return err(handleError('Migration failed', error))
  }
  finally {
    if (lockHandle) {
      try {
        await lockHandle.release()
      }
      catch {
        // Best effort; advisory locks auto-release on disconnect and
        // SQLite file locks have a staleness fallback. Don't shadow
        // the original failure with a release error.
      }
    }
    await restoreHiddenMigrations(hidden)
  }
}

/**
 * Framework tables that are not part of user models but need to be dropped
 * These include OAuth tables, passkeys, and other framework-managed tables
 */
const FRAMEWORK_TABLES = [
  'oauth_refresh_tokens', // Drop first due to foreign key to oauth_access_tokens
  'oauth_access_tokens',
  'oauth_clients',
  'passkeys',
  'failed_jobs',
  'jobs',
  'notifications',
  'password_reset_tokens',
]

/**
 * Reset the database (drop all tables)
 */
export async function resetDatabase(): Promise<Result<string, Error>> {
  try {
    // Configure bun-query-builder with stacks database settings
    configureQueryBuilder()

    const modelsDir = path.userModelsPath()
    const dialect = getDialect()

    // Drop framework tables first (OAuth, passkeys, etc.)
    await dropFrameworkTables(dialect)

    // Then drop user model tables
    await qbResetDatabase(modelsDir, { dialect })

    return ok('All tables dropped successfully!')
  }
  catch (error) {
    return err(handleError('Database reset failed', error))
  }
}

/**
 * Drop framework-managed tables (OAuth, passkeys, jobs, etc.)
 */
async function dropFrameworkTables(dialect: 'sqlite' | 'mysql' | 'postgres'): Promise<void> {
  // Disable foreign key checks for MySQL to avoid constraint issues
  if (dialect === 'mysql') {
    try {
      await (db as any).unsafe('SET FOREIGN_KEY_CHECKS = 0').execute()
    }
    catch (error) {
      log.warn(`Could not disable foreign key checks: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // Disable foreign key checks for SQLite
  if (dialect === 'sqlite') {
    try {
      await (db as any).unsafe('PRAGMA foreign_keys = OFF').execute()
    }
    catch (error) {
      log.warn(`Could not disable foreign key checks: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  for (const tableName of FRAMEWORK_TABLES) {
    try {
      // SQLite uses double quotes or no quotes, MySQL uses backticks, Postgres uses double quotes with CASCADE
      let dropSql: string
      if (dialect === 'postgres') {
        dropSql = `DROP TABLE IF EXISTS "${tableName}" CASCADE`
      }
      else if (dialect === 'mysql') {
        dropSql = `DROP TABLE IF EXISTS \`${tableName}\``
      }
      else {
        // SQLite - use double quotes for identifiers
        dropSql = `DROP TABLE IF EXISTS "${tableName}"`
      }

      log.info(`Dropping framework table: ${tableName}`)

      await (db as any).unsafe(dropSql).execute()

      log.info(`Dropped framework table: ${tableName}`)
    }
    catch (error) {
      // Log the actual error for debugging, but continue with other tables
      log.warn(`Could not drop table ${tableName}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // Re-enable foreign key checks for MySQL
  if (dialect === 'mysql') {
    try {
      await (db as any).unsafe('SET FOREIGN_KEY_CHECKS = 1').execute()
    }
    catch (error) {
      log.warn(`Could not re-enable foreign key checks: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // Re-enable foreign key checks for SQLite
  if (dialect === 'sqlite') {
    try {
      await (db as any).unsafe('PRAGMA foreign_keys = ON').execute()
    }
    catch (error) {
      log.warn(`Could not re-enable foreign key checks: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}

/**
 * Generate migrations based on model changes.
 *
 * Compares the current `app/Models/*` definitions to the stored snapshot
 * (`.qb/model-snapshot.<dialect>.json`) via bun-query-builder, then — if
 * there are changes — writes the resulting ALTER/CREATE/DROP statements
 * out to a fresh file in `database/migrations/`. Each statement is
 * grouped by table + DDL verb and lands in its own file using the
 * runner's existing naming convention so it picks them up the same way
 * as a hand-written migration.
 *
 * Without this write step the qb generator stages the diff in memory but
 * the runner never sees it, so model edits silently no-op'd — defeating
 * the "models are the source of truth" promise.
 */
export async function generateMigrations(): Promise<Result<string, Error>> {
  try {
    // Step-progress at debug — buddy's intro/outro carries the user-
    // visible signal. On a no-op generate we want zero lines between
    // those two; on a real generate the per-file written count below
    // is the meaningful breadcrumb.
    log.debug('Generating migrations...')

    // Configure bun-query-builder with stacks database settings
    configureQueryBuilder()

    const dialect = getDialect()
    const { modelsDir, skip } = prepareMigrationModelsDir()
    if (skip) {
      log.debug('No app/Models directory found; using committed framework migrations')
      return ok('Migrations generated')
    }

    log.debug(`[migration] Generating migrations for dialect: ${dialect}, models: ${modelsDir}`)
    const result = await qbGenerateMigration(modelsDir, { dialect })

    if (result.hasChanges) {
      const written = persistGeneratedMigrations(result.sqlStatements ?? [])
      // Only announce when we actually wrote files. `hasChanges` can be
      // true while `written === 0` if the qb diff restated statements
      // already covered by committed migrations — that's a no-op from
      // the user's perspective, so stay quiet.
      if (written > 0)
        log.success(`Generated ${written} migration file${written === 1 ? '' : 's'}`)
      else
        log.debug('Migration generation produced no new files (already up to date)')
    }
    else {
      log.debug('No changes detected')
    }

    return ok('Migrations generated')
  }
  catch (error) {
    return err(handleError('Migration generation failed', error))
  }
}

/**
 * Write generated SQL to `database/migrations/` so the runner picks it up.
 * Returns the number of files written.
 */
function persistGeneratedMigrations(sqlStatements: string[]): number {
  if (!sqlStatements?.length)
    return 0

  const migrationsDir = join(process.cwd(), 'database', 'migrations')
  try { require('node:fs').mkdirSync(migrationsDir, { recursive: true }) }
  catch { /* already exists */ }

  // Skip statements already represented in committed migrations. The qb
  // diff will sometimes restate things after the snapshot gets rewritten,
  // and we'd rather no-op than create a duplicate file.
  let existingSql = ''
  try {
    for (const f of readdirSync(migrationsDir).filter(f => f.endsWith('.sql')))
      existingSql += `\n${readFileSync(join(migrationsDir, f), 'utf8')}`
  }
  catch { /* nothing committed yet */ }
  const normalize = (s: string): string => s.replace(/\s+/g, ' ').trim()
  const haystack = normalize(existingSql)

  const groups = groupGeneratedStatements(sqlStatements)
  let written = 0
  let cursor = nextMigrationNumber(migrationsDir)

  for (const group of groups) {
    const fresh = group.statements.filter(stmt => !haystack.includes(normalize(stmt)))
    if (fresh.length === 0)
      continue

    const filename = `${String(cursor).padStart(10, '0')}-${group.label}.sql`
    const filePath = join(migrationsDir, filename)
    const body = `${fresh.map(s => s.trim().replace(/;\s*$/, '')).join(';\n')};\n`
    writeFileSync(filePath, body)
    log.debug(`[migration] Wrote ${filename} (${fresh.length} stmt${fresh.length === 1 ? '' : 's'})`)
    written += 1
    cursor += 1
  }

  return written
}

interface GeneratedGroup {
  label: string
  statements: string[]
}

/**
 * Group generated SQL by the migration filename style the runner already
 * uses for hand-written files: `create-<table>-table`,
 * `alter-<table>-<col>`, `create-<index>-index-in-<table>`, or
 * `drop-<table>-table`. Anything we can't match falls back to `auto-misc`.
 */
function groupGeneratedStatements(sqlStatements: string[]): GeneratedGroup[] {
  const groups = new Map<string, string[]>()
  const push = (label: string, stmt: string): void => {
    const list = groups.get(label) ?? []
    list.push(stmt)
    groups.set(label, list)
  }

  for (const raw of sqlStatements) {
    const stmt = raw.trim()
    if (!stmt) continue

    const create = stmt.match(/^\s*CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?(\w+)["`]?/i)
    if (create) { push(`create-${create[1]}-table`, stmt); continue }

    const alter = stmt.match(/^\s*ALTER\s+TABLE\s+["`]?(\w+)["`]?\s+(?:ADD\s+COLUMN\s+["`]?(\w+)["`]?|DROP\s+COLUMN\s+["`]?(\w+)["`]?|ADD\s+CONSTRAINT)/i)
    if (alter) { push(`alter-${alter[1]}-${alter[2] || alter[3] || 'constraint'}`, stmt); continue }

    const idx = stmt.match(/^\s*CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?(\w+)["`]?\s+ON\s+["`]?(\w+)["`]?/i)
    if (idx) { push(`create-${idx[1]}-index-in-${idx[2]}`, stmt); continue }

    const drop = stmt.match(/^\s*DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?["`]?(\w+)["`]?/i)
    if (drop) { push(`drop-${drop[1]}-table`, stmt); continue }

    push('auto-misc', stmt)
  }

  return [...groups.entries()].map(([label, statements]) => ({ label, statements }))
}

function nextMigrationNumber(migrationsDir: string): number {
  let max = 0
  try {
    for (const f of readdirSync(migrationsDir)) {
      const m = f.match(/^(\d+)-/)
      if (m?.[1]) max = Math.max(max, Number.parseInt(m[1], 10))
    }
  }
  catch { /* directory missing — start at 1 */ }
  return max + 1
}

/**
 * Generate fresh migrations (full regeneration, ignoring previous state)
 */
export async function generateMigrations2(): Promise<Result<string, Error>> {
  try {
    log.info('Generating fresh migrations...')

    // Configure bun-query-builder with stacks database settings
    configureQueryBuilder()

    const dialect = getDialect()
    const { modelsDir, skip } = prepareMigrationModelsDir()
    if (skip) {
      log.info('No app/Models directory found; using committed framework migrations')
      return ok('Migrations generated')
    }

    await qbGenerateMigration(modelsDir, { dialect, full: true })

    log.success('Migrations generated')
    return ok('Migrations generated')
  }
  catch (error) {
    return err(handleError('Fresh migration generation failed', error))
  }
}

/**
 * Migration result type for compatibility
 */
export interface MigrationResult {
  migrationName: string
  direction: 'Up' | 'Down'
  status: 'Success' | 'Error' | 'NotExecuted'
}

export type { MigrationResult as MigrationResultType }
