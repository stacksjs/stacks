/**
 * Database Migrations using bun-query-builder
 *
 * This module provides migration functionality for the stacks framework
 * powered by bun-query-builder.
 */

import type { Result } from '@stacksjs/error-handling'
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
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
import { defaultModelsPath } from './seeder'
import type { MigrationOperation, MigrationPlan } from '@stacksjs/query-builder'
import {
  createQueryBuilder,
  executeMigration as qbExecuteMigration,
  generateMigration as qbGenerateMigration,
  resetDatabase as qbResetDatabase,
  config as qbConfig,
  saveMigrationSnapshot,
  setConfig,
} from '@stacksjs/query-builder'
import { db, qbSnapshotDir, resetDatabaseConnection } from './utils'
import {
  classifyConnectionError,
  createDatabase,
  describeTarget,
  manualCreateHint,
  probeTargetDatabase,
  resolveConnectionTarget,
} from './ensure-database'
import { resolveModelSources } from './model-sources'
import { findShadowedColumnDrops, shadowDropsAllowed, shadowedDropMessage } from './shadowed-models'
import { frameworkManagedColumns, withoutManagedColumnDrops, withoutManagedColumnDropSql } from './managed-columns'
import { acquireMigrationLock } from './migration-lock'
import { relativeMigrationDirectory, resolveMigrationDirectory } from './migration-path'
import { ensureNotificationForeignKeys, migrateNotificationTables, notificationTablesMissingCreateStatements } from './notification-tables'
import { traitTableNames } from './trait-tables'

// Use environment variables via @stacksjs/env for proper type coercion
import { env as envVars } from '@stacksjs/env'
import { getConnectionDefaults } from './defaults'
import { isVitessSharded } from './dialect'

// Shell-provided values must win over the loaded .env file. The migration
// executor already follows process.env, so resolving preprocessing against
// only the typed proxy can point the two phases at different SQLite files
// when a command uses `DB_DATABASE_PATH=/tmp/audit.sqlite buddy migrate`.
const databaseEnv = {
  DB_CONNECTION: process.env.DB_CONNECTION || envVars.DB_CONNECTION,
  DB_DATABASE_PATH: process.env.DB_DATABASE_PATH || envVars.DB_DATABASE_PATH,
  DB_DATABASE: process.env.DB_DATABASE || envVars.DB_DATABASE,
  DB_HOST: process.env.DB_HOST || envVars.DB_HOST,
  DB_PORT: process.env.DB_PORT ? Number(process.env.DB_PORT) : envVars.DB_PORT,
  DB_USERNAME: process.env.DB_USERNAME || envVars.DB_USERNAME,
  DB_PASSWORD: process.env.DB_PASSWORD || envVars.DB_PASSWORD,
  DB_VITESS_SHARDED: process.env.DB_VITESS_SHARDED || envVars.DB_VITESS_SHARDED,
}

// Build database config from environment variables
const dbDriver = databaseEnv.DB_CONNECTION || 'sqlite'
const sqliteDefaults = getConnectionDefaults('sqlite', databaseEnv)
const mysqlDefaults = getConnectionDefaults('mysql', databaseEnv)
const singlestoreDefaults = getConnectionDefaults('singlestore', databaseEnv)
const vitessDefaults = getConnectionDefaults('vitess', databaseEnv)
const postgresDefaults = getConnectionDefaults('postgres', databaseEnv)

const dbConfig = {
  default: dbDriver,
  connections: {
    sqlite: { database: sqliteDefaults.database, prefix: '' },
    mysql: { name: mysqlDefaults.database, host: mysqlDefaults.host, username: mysqlDefaults.username, password: mysqlDefaults.password, port: mysqlDefaults.port, prefix: '' },
    singlestore: { name: singlestoreDefaults.database, host: singlestoreDefaults.host, username: singlestoreDefaults.username, password: singlestoreDefaults.password, port: singlestoreDefaults.port, prefix: '' },
    vitess: { name: vitessDefaults.database, host: vitessDefaults.host, username: vitessDefaults.username, password: vitessDefaults.password, port: vitessDefaults.port, prefix: '', sharded: isVitessSharded(databaseEnv.DB_VITESS_SHARDED) },
    postgres: { name: postgresDefaults.database, host: postgresDefaults.host, username: postgresDefaults.username, password: postgresDefaults.password, port: postgresDefaults.port, prefix: '' },
  },
}

function sqliteDatabasePath(): string {
  const configured = dbConfig.connections.sqlite.database || 'stacks.db'
  return isAbsolute(configured) ? configured : join(process.cwd(), configured)
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
function getDialect(): 'sqlite' | 'mysql' | 'vitess' | 'postgres' {
  const driver = getDriver()
  if (driver === 'sqlite' || driver === 'mysql' || driver === 'vitess' || driver === 'postgres') return driver
  // SingleStore is MySQL wire-compatible, so all of the internal migration
  // plumbing that needs a concrete engine (connection ports, admin database,
  // DROP TABLE) treats it as MySQL. DDL *generation* is different — it must
  // use the real 'singlestore' dialect so bun-query-builder's SingleStore
  // driver drops foreign keys (which SingleStore rejects). See getQbDialect.
  if (driver === 'singlestore') return 'mysql'
  if (driver === 'dynamodb') {
    throw new Error(
      '[database] DB_CONNECTION=dynamodb is not compatible with the SQL migration runner. '
      + 'DynamoDB has no schema-migration concept - use the entity-style `dynamo.entity(...)` '
      + 'API from @stacksjs/database directly. To run SQL migrations, set DB_CONNECTION to one of: sqlite, mysql, singlestore, vitess, postgres.',
    )
  }
  throw new Error(
    `[database] Unknown DB_CONNECTION "${driver}". Allowed values: sqlite, mysql, singlestore, vitess, postgres, dynamodb.`,
  )
}

/**
 * The dialect handed to bun-query-builder's DDL generator. Identical to
 * `getDialect()` except SingleStore is preserved (not collapsed to MySQL) so
 * bqb selects its SingleStore driver — which drops foreign-key constraints
 * (unsupported by SingleStore) and can emit distributed-table clauses.
 */
function getQbDialect(): 'sqlite' | 'mysql' | 'singlestore' | 'vitess' | 'postgres' {
  return getDriver() === 'singlestore' ? 'singlestore' : getDialect()
}

function migrationDirectory(dialect: string = getQbDialect()): string {
  return resolveMigrationDirectory(dialect, {
    configured: (qbConfig as { migrationDir?: string }).migrationDir,
    snapshotDir: qbSnapshotDir(),
  })
}

/**
 * Configure bun-query-builder with stacks database settings
 */
function configureQueryBuilder(
  targetDialect: 'sqlite' | 'mysql' | 'singlestore' | 'vitess' | 'postgres' = getQbDialect(),
  vitessSharded?: boolean,
): void {
  const connectionConfig = dbConfig.connections[targetDialect] as any

  setConfig({
    dialect: targetDialect,
    vitess: {
      sharded: isVitessSharded(vitessSharded ?? connectionConfig?.sharded),
    },
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
    // Keep the model snapshot with the rest of the generated framework state.
    // The library defaults to `.qb` at the project root, which puts a
    // dot-directory in every Stacks app holding something the app never chose
    // to place there. `storage/framework` is where generated framework state
    // already lives, so it belongs there.
    snapshotDir: qbSnapshotDir(),
    migrationDir: relativeMigrationDirectory(migrationDirectory(targetDialect)),
    database: {
      database: connectionConfig?.name || connectionConfig?.database || 'stacks',
      host: connectionConfig?.host || 'localhost',
      port: connectionConfig?.port || (targetDialect === 'postgres' ? 5432 : targetDialect === 'vitess' ? 15306 : targetDialect === 'mysql' || targetDialect === 'singlestore' ? 3306 : 0),
      username: connectionConfig?.username || '',
      password: connectionConfig?.password || '',
    },
  })

  // Reset the connection to ensure the new config is used
  resetDatabaseConnection()
}

export function prepareMigrationModelsDir(): {
  modelsDir: string
  skip: boolean
  /**
   * Tables owned by framework default models that are out of scope. Reported to
   * the user, so it stays limited to the models — see {@link protectedTables}
   * for what actually suppresses a drop.
   */
  excludedTables: string[]
  /**
   * Every table the generator has no authority to drop.
   *
   * {@link excludedTables} plus the polymorphic trait tables. The trait tables
   * need saying separately because `declaredTableName` reads a model's OWN
   * table and nothing else: the framework's `Post` declares `taggable_models`
   * and `categorizable_models` as `belongsToMany` pivots, so when `Post` leaves
   * scope those two enter the diff as tables the app deleted, while the models
   * exclusion set never hears about them (stacksjs/stacks#2255).
   *
   * They would be dropped and then recreated empty by `migrateTraitTables()` in
   * the same `buddy migrate` — data loss with no schema change to show for it.
   */
  protectedTables: string[]
} {
  const sources = resolveModelSources()
  const excludedTables = sources?.excludedTables ?? []
  return {
    modelsDir: sources?.dir ?? path.userModelsPath(),
    skip: !sources,
    excludedTables,
    protectedTables: [...new Set([...excludedTables, ...traitTableNames()])],
  }
}

const DROP_TABLE_RE = /^\s*DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?["'`]?(\w+)["'`]?/i

/**
 * Drop the generated `DROP TABLE`s for tables that are simply out of the
 * generator's scope, rather than deleted.
 *
 * The generator diffs the model set against the stored snapshot, so the first
 * run after framework defaults stop being merged (stacksjs/stacks#2220) sees
 * sixty-odd tables vanish from the model set and proposes dropping every one
 * of them — including any that hold data. "This app no longer generates this
 * table" is not "destroy this table"; the same distinction
 * `withoutManagedColumnDropSql` draws for framework-managed columns.
 *
 * Two kinds of table qualify, both supplied via `prepareMigrationModelsDir`'s
 * `protectedTables`: framework defaults left out of scope, and the polymorphic
 * trait tables, which arrive in the snapshot as pivots of a framework model and
 * would be recreated empty moments later by `migrateTraitTables`
 * (stacksjs/stacks#2255).
 *
 * Self-limiting for the first kind: the snapshot advances to the narrowed model
 * set at the end of the same run, so those drops are never proposed again. A
 * table an app really does want gone is still dropped by hand, the way it
 * always was.
 */
export function withoutProtectedTableDropSql(
  statements: string[],
  protectedTables: readonly string[],
  operations: readonly MigrationOperation[],
): { statements: string[], removed: string[] } {
  if (protectedTables.length === 0)
    return { statements, removed: [] }

  const excluded = new Set(protectedTables.map(table => table.toLowerCase()))
  const normalize = (sql: string): string => sql.replace(/\s+/g, ' ').trim().replace(/;$/, '')
  const dropped = new Set(
    operations
      .filter(op => op.kind === 'drop_table' && excluded.has(op.table.toLowerCase()))
      .filter(op => Boolean(op.sql))
      .map(op => normalize(op.sql)),
  )

  const removed: string[] = []
  const kept = statements.filter((statement) => {
    if (dropped.has(normalize(statement))) {
      removed.push(statement)
      return false
    }
    // Fallback for a dialect whose emitted statement doesn't match the
    // operation's `sql` byte for byte (Postgres appends CASCADE, MySQL uses
    // backticks). The shape is simple enough to match directly.
    const match = statement.match(DROP_TABLE_RE)
    if (match?.[1] && excluded.has(match[1].toLowerCase())) {
      removed.push(statement)
      return false
    }
    return true
  })

  return { statements: kept, removed }
}

/**
 * SQLite compatibility preprocessing for migrations.
 *
 * SQLite does not support:
 * - ALTER TABLE ADD CONSTRAINT (foreign keys must be defined at table creation)
 * - CREATE TYPE ... AS ENUM (SQLite has no user-defined types; enum columns
 *   are plain TEXT, with the allowed values enforced at the validation layer)
 *
 * Note: CREATE UNIQUE INDEX files are deliberately NOT skipped — the SQLite
 * dialect driver never renders inline UNIQUE in CREATE TABLE, so the
 * standalone index file is the only uniqueness enforcement on SQLite
 * (stacksjs/stacks#1952).
 *
 * Two flavours of "no-op on SQLite" need different handling:
 *
 *   - **Skip-and-keep** (`skipMigration`): the file is portable — it would
 *     run cleanly on MySQL/Postgres — but doesn't apply to SQLite. Record
 *     it as executed in the migrations tracking table so it doesn't replay,
 *     but **leave the file on disk** so a future `DB_CONNECTION` flip can
 *     pick it up. This is the right path for FK constraint files.
 *     (stacksjs/stacks#1916)
 *
 *   - **Drop-and-delete** (`deleteMigration`): the file is genuinely dead
 *     — currently limited to an unrecorded duplicate CREATE TABLE created by
 *     `buddy generate:migrations`. Recorded files are immutable migration
 *     history, regardless of the current live schema.
 */
/**
 * Split a migration file into its statements.
 *
 * Comments come out FIRST, before the split on `;`. Splitting first and then
 * dropping the chunks that begin with `--` looks equivalent and is not: a
 * file that opens with a comment header — which every hand-written migration
 * in this repo does — glues that header to its first statement, so the chunk
 * begins with `--` and the statement disappears with the comment. Everything
 * downstream then reasons about a file it has only partly read, and the
 * ADD COLUMN reconciliation below would happily record a file as fully
 * applied while its first column had never been created.
 */
export function sqlStatementsOf(content: string): string[] {
  const statements: string[] = []
  let current = ''
  let quote: 'single' | 'double' | null = null
  let dollarTag: string | null = null

  for (let i = 0; i < content.length; i++) {
    const char = content[i]!

    // Inside a dollar-quoted body ($$ … $$ or $tag$ … $tag$) nothing is
    // punctuation: a `;` there belongs to the body. Without this a `DO $$ …
    // END $$;` block - which is the only way to write an idempotent
    // CREATE TYPE - is torn into fragments that are not valid SQL on their own.
    if (dollarTag) {
      current += char
      if (char === '$' && content.startsWith(dollarTag, i)) {
        current += content.slice(i + 1, i + dollarTag.length)
        i += dollarTag.length - 1
        dollarTag = null
      }
      continue
    }

    if (quote) {
      current += char
      if ((quote === 'single' && char === '\'') || (quote === 'double' && char === '"'))
        quote = null
      continue
    }

    // A comment runs to the end of the line, but only outside a string: a `--`
    // inside a default value is data.
    if (char === '-' && content[i + 1] === '-') {
      const newline = content.indexOf('\n', i)
      if (newline === -1)
        break
      i = newline - 1
      continue
    }

    const dollar = char === '$' ? /^\$[A-Za-z_]*\$/.exec(content.slice(i)) : null
    if (dollar) {
      dollarTag = dollar[0]
      current += dollarTag
      i += dollarTag.length - 1
      continue
    }

    if (char === '\'') {
      quote = 'single'
      current += char
      continue
    }

    if (char === '"') {
      quote = 'double'
      current += char
      continue
    }

    if (char === ';') {
      const trimmed = current.trim()
      if (trimmed.length > 0)
        statements.push(trimmed)
      current = ''
      continue
    }

    current += char
  }

  const trailing = current.trim()
  if (trailing.length > 0)
    statements.push(trailing)

  return statements
}

/**
 * Make a Postgres `CREATE TYPE … AS ENUM` statement safe to run twice, and make
 * it mean something when the type is already there.
 *
 * `CREATE TYPE` has no `IF NOT EXISTS`, so a corpus containing one can only be
 * applied to a database that has never seen it. Every other way a migration run
 * can be interrupted - a partially recorded ledger, a schema restored from a
 * dump, a database built before the ledger existed - leaves `buddy migrate`
 * dead on the first enum it meets, with an error naming a type that is already
 * exactly right.
 *
 * The guard is a `DO` block catching `duplicate_object`, which needs a
 * dollar-quoted body - hence the splitter above having to understand one.
 *
 * The guard on its own is not enough, and quietly broke the case it sat next
 * to. Adding a value to an enum in a model generates a `CREATE TYPE` naming the
 * full new set; on a database that already has the type, the guard swallows it
 * and the new value never arrives. The column keeps the old set, every insert
 * using the new value fails, and the next diff proposes the same statement
 * again - which is exactly the silent-no-op loop the guard was introduced to
 * end, moved one step along.
 *
 * So each member is also asserted with `ALTER TYPE … ADD VALUE IF NOT EXISTS`,
 * which is idempotent on its own and is a no-op on the fresh-database path
 * where the `CREATE TYPE` just defined all of them. Values are only ever added:
 * removing one would need a rewrite of every row that carries it, which is a
 * data migration and not something a schema diff may decide to do by itself.
 */
/**
 * Put a `DROP DEFAULT` in front of every `ALTER COLUMN … TYPE …`.
 *
 * Postgres checks a column's existing default against the new type and refuses
 * the whole statement when it cannot cast it - a `varchar` column defaulting to
 * `'pending'` becoming an enum fails every time. The generator emits the right
 * order now, but migration files are history: every corpus written before that
 * still carries the old one, and re-running it fails on a database that has not
 * caught up yet.
 *
 * Rewriting them here is the same bargain the rest of this pass makes. Adding
 * the drop is safe whatever the column had, because the statement that follows
 * either sets the new default or deliberately leaves none.
 */
export function orderPostgresColumnTypeChanges(sql: string): string {
  const lines = sql.split('\n')
  const output: string[] = []

  for (const line of lines) {
    const match = /^(\s*)ALTER\s+TABLE\s+("?[\w.]+"?)\s+ALTER\s+COLUMN\s+("?[\w]+"?)\s+TYPE\s/i.exec(line)

    if (match) {
      const [, indent, table, column] = match
      const drop = `${indent}ALTER TABLE ${table} ALTER COLUMN ${column} DROP DEFAULT;`
      // Only when it is not already there, so running the pass twice does not
      // stack a second copy on every type change in the corpus.
      const previous = output.length > 0 ? output[output.length - 1]!.trim() : ''
      if (previous !== drop.trim())
        output.push(drop)
    }

    output.push(line)
  }

  return output.join('\n')
}

export function guardPostgresEnumTypes(sql: string): string {
  return assertPostgresEnumMembers(wrapPostgresEnumTypes(sql))
}

/** The `DO` block half: make `CREATE TYPE` survive a second run. */
function wrapPostgresEnumTypes(sql: string): string {
  return sql.replace(
    /CREATE\s+TYPE\s+("?[\w.]+"?)\s+AS\s+ENUM\s*\(([^)]*)\)/gi,
    (match, name: string, members: string, offset: number, whole: string) => {
      // Already guarded. Checked against what comes *before* the match rather
      // than the match itself, because the guard wraps the CREATE TYPE rather
      // than containing it. Getting this wrong nests the guard one layer deeper
      // on every run - and this transform rewrites the files on disk, so the
      // damage compounds.
      if (/\bBEGIN\s*$/i.test(whole.slice(Math.max(0, offset - 40), offset)))
        return match

      return `DO $stacks$ BEGIN CREATE TYPE ${name} AS ENUM (${members}); `
        + 'EXCEPTION WHEN duplicate_object THEN null; END $stacks$'
    },
  )
}

/**
 * The `ADD VALUE` half: make the guard mean something on a database that
 * already has the type.
 *
 * Written against the guarded block rather than folded into the wrapper,
 * because a corpus that was already guarded by an earlier version is the case
 * that matters: those files are on disk, they name enums that have since gained
 * values, and a transform that only fires on a bare `CREATE TYPE` would never
 * look at them again.
 */
function assertPostgresEnumMembers(sql: string): string {
  return sql.replace(/DO \$stacks\$[\s\S]*?END \$stacks\$;?/g, (block) => {
    const created = /CREATE\s+TYPE\s+("?[\w.]+"?)\s+AS\s+ENUM\s*\(([^)]*)\)/i.exec(block)
    if (!created)
      return block

    const [, name, members] = created
    const missing = enumMembers(members!)
      .map(member => `ALTER TYPE ${name} ADD VALUE IF NOT EXISTS ${member};`)
      // Against the whole file, so a type created in one place and extended in
      // another is not asserted twice.
      .filter(statement => !sql.includes(statement))

    if (missing.length === 0)
      return block

    const terminated = block.endsWith(';') ? block : `${block};`

    return `${terminated}\n${missing.join('\n')}`
  })
}

/**
 * The members of an `AS ENUM (…)` list, as they were written.
 *
 * Split on the commas *between* literals rather than on every comma: a value
 * like `'multi-channel, beta'` is one member, and a naive split turns it into
 * two that no `ADD VALUE` can name. Postgres escapes a quote inside a literal
 * by doubling it, which is why the pattern lets a quote run through `''`.
 */
function enumMembers(list: string): string[] {
  return [...list.matchAll(/'(?:[^']|'')*'/g)].map(match => match[0])
}

export function preprocessSqliteMigrations(): void {
  const migrationsDir = migrationDirectory('sqlite')
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
  const skipMigration = (file: string, reason: string): void => {
    // Portable migration that doesn't apply to SQLite — file stays on
    // disk so it can run if the consumer ever switches to MySQL/Postgres.
    log.info(`Skipping migration on SQLite (${reason}): ${file}`)
    droppedMigrations.push(file)
  }
  const deleteMigration = (file: string, filePath: string, reason: string): void => {
    // Genuinely dead file — duplicate or unreachable. Safe to remove.
    log.info(`Dropping no-op migration (${reason}): ${file}`)
    try { unlinkSync(filePath) }
    catch { /* already gone */ }
    droppedMigrations.push(file)
  }

  // Unique-index files the old skip logic wrongly recorded as executed.
  // Their indexes never got created — deleting the row from the
  // migrations table makes the runner pick the file back up.
  const replayMigrations: string[] = []

  const addConstraintPattern = /^\s*ALTER\s+TABLE\s+.+\s+ADD\s+CONSTRAINT\s+/i
  const createTypePattern = /^\s*CREATE\s+TYPE\s+/i
  // Match CREATE UNIQUE INDEX, capturing the index name. These files MUST run
  // on SQLite — the dialect driver never renders inline UNIQUE in CREATE
  // TABLE, so this index is the only uniqueness enforcement (#1952).
  // IF NOT EXISTS makes them idempotent by name; SQLite accepts a unique
  // index alongside an inline constraint; a genuine SQLITE_CONSTRAINT
  // failure means duplicate rows already exist and must surface.
  const createUniqueIndexPattern = /^\s*CREATE\s+UNIQUE\s+INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?["'`]?(\w+)["'`]?/i
  // Match ALTER TABLE ... DROP COLUMN — SQLite fails if the column doesn't exist
  const dropColumnPattern = /^\s*ALTER\s+TABLE\s+["']?(\w+)["']?\s+DROP\s+COLUMN\s+["']?(\w+)["']?\s*$/i
  // Match ALTER TABLE ... ADD COLUMN — the mirror case: SQLite fails with
  // "duplicate column name" if the column is already there. Postgres gets
  // `ADD COLUMN IF NOT EXISTS` from `makeMigrationsIdempotent`; SQLite has no
  // such syntax, so replay safety has to be decided here, against the schema.
  const addColumnPattern = /^\s*ALTER\s+TABLE\s+["']?(\w+)["']?\s+ADD\s+COLUMN\s+["'`]?(\w+)["'`]?/i
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

  const earlierCreateDefinesColumn = (migrationFile: string, table: string, column: string): boolean => {
    const createFile = createTableEarliest.get(table)
    if (!createFile || createFile >= migrationFile)
      return false

    try {
      const createContent = readFileSync(join(migrationsDir, createFile), 'utf8')
      const createStatement = sqlStatementsOf(createContent)
        .find(statement => statement.match(createTablePattern)?.[1] === table)
      if (!createStatement)
        return false

      const escapedColumn = column.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      return new RegExp(`(?:^|[,(])\\s*["'\`]?${escapedColumn}["'\`]?\\s+`, 'i').test(createStatement)
    }
    catch {
      return false
    }
  }

  // Open SQLite DB to check column existence for DROP COLUMN migrations
  const sqliteDbPath = sqliteDatabasePath()
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

  const migrationWasRecorded = (file: string): boolean => {
    if (!sqliteDb)
      return false

    try {
      return Boolean(
        (sqliteDb as any)
          .prepare('SELECT 1 FROM migrations WHERE migration = ? LIMIT 1')
          .get(file),
      )
    }
    catch {
      return false
    }
  }

  for (const file of files) {
    log.debug(`[migration] Running: ${file}`)
    const filePath = join(migrationsDir, file)
    const content = readFileSync(filePath, 'utf-8')
    const statements = sqlStatementsOf(content)

    if (statements.length === 0) continue

    // Self-heal databases the old skip logic poisoned: it recorded
    // unique-index files as executed without ever creating the index, so
    // `email: { unique: true }` etc. were never enforced. This is the one
    // intentional exception to recorded migration immutability: a missing
    // index proves that the historical record is false, so re-queue the file.
    const uniqueIndexNames = statements
      .map(s => s.match(createUniqueIndexPattern)?.[1])
      .filter((name): name is string => Boolean(name))
    if (sqliteDb && uniqueIndexNames.length === statements.length) {
      const indexExists = (sqliteDb as any).prepare(`SELECT name FROM sqlite_master WHERE type = 'index' AND name = ?`)
      const missing = uniqueIndexNames.filter(name => !indexExists.get(name))
      if (missing.length > 0) {
        log.info(`Re-queueing unique-index migration (index missing from database): ${file}`)
        replayMigrations.push(file)
      }
      continue
    }

    // Migration files are append-only history. Once a file is recorded, its
    // SQL must not be deleted or rewritten merely because the live schema now
    // reflects it. The executor will not run it again, so preprocessing it can
    // only destroy the upgrade path for fresh databases and other dialects.
    if (migrationWasRecorded(file))
      continue

    // Drop duplicate CREATE TABLE migrations — keep only the earliest one
    // for each table. This handles the case where buddy regenerates a
    // create-table migration for a table that's already modeled. These
    // ARE genuinely dead — the table already exists, the file would
    // either no-op or error, and we don't want them in a future
    // MySQL/Postgres replay either. Safe to delete.
    const firstStatement = statements[0]
    const createTableMatch = firstStatement ? firstStatement.match(createTablePattern) : null
    if (createTableMatch && createTableMatch[1]) {
      const tableName = createTableMatch[1]
      const earliest = createTableEarliest.get(tableName)
      if (earliest && earliest !== file) {
        deleteMigration(file, filePath, `duplicate create-table for "${tableName}" (kept ${earliest})`)
        continue
      }
    }

    // Skip files that only contain ALTER TABLE ADD CONSTRAINT.
    //
    // SQLite cannot execute this — FKs are inline on CREATE TABLE
    // (stacksjs/bun-query-builder#1019). But the file is perfectly
    // valid on MySQL/Postgres, so we KEEP IT ON DISK and just mark
    // it as executed in the migrations table for SQLite. A later
    // DB_CONNECTION flip can replay these files against the new
    // backend. (stacksjs/stacks#1916)
    const allAddConstraint = statements.every(s => addConstraintPattern.test(s))
    if (allAddConstraint) {
      skipMigration(file, 'SQLite does not support ALTER TABLE ADD CONSTRAINT')
      continue
    }

    // Skip files that only contain CREATE TYPE ... AS ENUM (Postgres enum
    // types). SQLite has no user-defined types — enum columns are plain
    // TEXT, with the allowed values enforced at the model/validation layer
    // — so `buddy generate:migrations`' enum-type "auto-misc" files are
    // dead on SQLite and their `CREATE TYPE` syntax otherwise dies a fresh
    // migrate with `near "TYPE": syntax error`. Same skip-and-keep policy
    // as ADD CONSTRAINT above: the file is valid on MySQL/Postgres, so
    // leave it on disk and just mark it executed for SQLite. (#1916)
    const allCreateType = statements.every(s => createTypePattern.test(s))
    if (allCreateType) {
      skipMigration(file, 'SQLite does not support CREATE TYPE (enum types)')
      continue
    }

    /*
     * An ALTER migration whose columns are already on the table.
     *
     * This happens whenever an ADD COLUMN file is applied but not recorded:
     * an earlier statement in the same file failed after this one landed, a
     * database was restored from a snapshot taken after the change, or the
     * column was applied by hand. SQLite has no `ADD COLUMN IF NOT EXISTS`,
     * so the replay dies with `duplicate column name` and takes the whole
     * migrate run with it — including every unrelated migration queued behind
     * it. The DROP COLUMN branch below already reconciles the opposite case
     * against the live schema; this is the same idea in the other direction.
     *
     * Skip-and-KEEP, never delete. An ADD COLUMN file is exactly what a fresh
     * database needs, so the statements have to stay intact on disk.
     */
    const addColumnTargets = statements
      .map(s => s.match(addColumnPattern))
      .filter((m): m is RegExpMatchArray => Boolean(m?.[1] && m[2]))
      .map(m => ({ table: m[1] as string, column: m[2] as string }))

    if (addColumnTargets.length > 0 && addColumnTargets.length === statements.length) {
      const satisfied = addColumnTargets.filter(({ table, column }) => {
        try {
          if (sqliteDb) {
            const safeTableName = table.replace(/[^a-zA-Z0-9_]/g, '')
            const columns = (sqliteDb as any).prepare(`PRAGMA table_info("${safeTableName}")`).all() as Array<{ name: string }>
            if (columns.some(col => col.name === column))
              return true
            if (columns.length > 0)
              return false
          }

          // On a fresh database preprocessing runs before the pending
          // CREATE TABLE files. If an earlier create migration already
          // defines this column, executing the later ALTER would fail even
          // though the live schema is currently empty.
          return earlierCreateDefinesColumn(file, table, column)
        }
        catch {
          return false
        }
      })

      if (satisfied.length === addColumnTargets.length) {
        skipMigration(file, 'every column it adds already exists or is defined by an earlier create-table migration')
        continue
      }

      // Partially applied. The file cannot be rewritten (a fresh database
      // needs all of it) and cannot run as-is, so say precisely which
      // statement will fail instead of letting `duplicate column name` be
      // the operator's only clue.
      if (satisfied.length > 0) {
        log.warn(
          `[migration] ${file} is partially applied: ${satisfied.map(p => `${p.table}.${p.column}`).join(', ')} `
          + `already exist${satisfied.length === 1 ? 's' : ''} or will be created earlier, the rest do not. SQLite cannot skip a single ADD COLUMN, so this file will fail. `
          + 'Add the remaining columns by hand, or split the file so the applied statements sit in their own migration.',
        )
      }
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
            // No database file means every migration is pending. If an earlier
            // create migration still defines the legacy column, this drop is
            // required later in the same fresh run and must remain untouched.
            if (earlierCreateDefinesColumn(file, tableName, columnName)) {
              filteredStatements.push(stmt)
              continue
            }

            log.info(`Skipping DROP COLUMN "${columnName}" - no database exists yet: ${file}`)
            modified = true
            continue
          }

          try {
            // Sanitize table name to prevent SQL injection (only allow alphanumeric and underscores)
            const safeTableName = tableName.replace(/[^a-zA-Z0-9_]/g, '')
            const columns = (sqliteDb as any).prepare(`PRAGMA table_info("${safeTableName}")`).all() as Array<{ name: string }>
            if (columns.length === 0) {
              // The table may be pending in an earlier migration. Preserve the
              // drop when that create file still defines the legacy column.
              if (earlierCreateDefinesColumn(file, tableName, columnName)) {
                filteredStatements.push(stmt)
                continue
              }

              log.info(`Skipping DROP COLUMN "${columnName}" - table "${tableName}" does not exist yet: ${file}`)
              modified = true
              continue
            }
            const columnExists = columns.some((col: { name: string }) => col.name === columnName)
            if (!columnExists) {
              log.info(`Skipping DROP COLUMN "${columnName}" from "${tableName}" - column does not exist: ${file}`)
              modified = true
              continue
            }
          }
          catch {
            if (earlierCreateDefinesColumn(file, tableName, columnName)) {
              filteredStatements.push(stmt)
              continue
            }

            log.info(`Skipping DROP COLUMN "${columnName}" - table "${tableName}" not found: ${file}`)
            modified = true
            continue
          }
        }
        filteredStatements.push(stmt)
      }

      if (modified) {
        if (filteredStatements.length === 0) {
          // The entire DROP COLUMN file is unreachable — column already
          // gone, table never existed. Safe to delete: a future
          // driver-switch replay wouldn't find the column either.
          deleteMigration(file, filePath, 'columns already absent from table')
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
  // the next `buddy generate:migrations` cycle, and un-record re-queued
  // unique-index migrations so the runner replays them (#1952). The DELETE
  // is a no-op for files that were never recorded.
  if (droppedMigrations.length > 0 || replayMigrations.length > 0) {
    try {
      const dbPath = sqliteDatabasePath()
      // Record the skips even when the DB file does NOT exist yet. On a
      // fresh SQLite install ensureDatabaseExists() is a no-op (SQLite
      // auto-creates on open), so the file is absent here — and if we
      // bailed on that, the skip records would never land and the runner
      // would then execute the very ALTER TABLE ADD CONSTRAINT / CREATE
      // TYPE files we just skipped, dying with a "near CONSTRAINT/TYPE"
      // syntax error on the first fresh migrate. `new Database()` creates
      // the file; qbExecuteMigration opens the same one next and honors
      // these records. (stacksjs/stacks#1916 fresh-install gap.)
      mkdirSync(dirname(dbPath), { recursive: true })
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
        const unrecord = writeDb.prepare('DELETE FROM migrations WHERE migration = ?')
        for (const migration of replayMigrations) unrecord.run(migration)
      }
      finally { writeDb.close() }
    }
    catch (e) {
      log.debug(`[migration] Could not record dropped migrations as executed: ${e}`)
    }
  }
}

/**
 * Whether a missing database may be created without asking.
 *
 * `STACKS_CREATE_DATABASE` is the internal parent-to-child signal: the buddy
 * CLI asks the human once, in the parent process where a TTY actually exists,
 * then hands the answer down to this action. `DB_CREATE_DATABASE=never` is the
 * user-facing opt-out for anyone who would rather provision databases
 * themselves.
 */
function mayCreateMissingDatabase(): boolean {
  const signal = process.env.STACKS_CREATE_DATABASE
  if (signal === '1')
    return true
  if (signal === '0')
    return false

  const policy = String(process.env.DB_CREATE_DATABASE || '').toLowerCase()
  return !(policy === 'never' || policy === 'false' || policy === '0')
}

/**
 * Turn a failed probe into one actionable sentence. Every branch names the
 * server we actually tried, because the most common cause of all of these is
 * pointing at the wrong one.
 */
function describeProbeFailure(
  target: ReturnType<typeof resolveConnectionTarget> & {},
  kind: string | undefined,
  error: unknown,
): string {
  const where = describeTarget(target)
  const detail = error instanceof Error ? error.message : String(error ?? '')

  switch (kind) {
    case 'missing-role':
      return `The user "${target.username}" does not exist on ${where}. `
        + `Set DB_USERNAME to a role that exists, or create it with:  createuser -s ${target.username}`
    case 'auth-failed':
      return `Authentication failed for user "${target.username}" on ${where}. Check DB_USERNAME and DB_PASSWORD.`
    case 'server-unreachable':
      return `Could not reach the database server at ${target.host}:${target.port}. `
        + `Check that it is running and that DB_HOST and DB_PORT are correct.`
    case 'timeout':
      return `Timed out connecting to the database server at ${target.host}:${target.port}. ${detail}`
    case 'permission-denied':
      return `The user "${target.username}" is not allowed to connect to "${target.database}" on ${where}.`
    default:
      return `Could not connect to the database "${target.database}" on ${where}. ${detail}`
  }
}

/**
 * Ensure the target database exists before anything tries to connect to it.
 *
 * SQLite creates its file on open, so this is a no-op there. Server-based
 * engines need an explicit CREATE DATABASE, issued over a maintenance
 * connection that `ensure-database.ts` opens with Bun's own SQL client.
 *
 * This used to reach the maintenance database through bun-query-builder's
 * `setConfig()`, which could never work: bqb's `createConnectionString()`
 * short-circuits whenever `process.env.DB_CONNECTION === dialect` and rebuilds
 * the URL from `process.env`, so the "admin" connection was silently pointed
 * back at the very database we were trying to create. That produced the
 * self-contradicting `Could not auto-create database "stacks": database
 * "stacks" does not exist`, logged as a warning that let a fatal condition
 * continue into a cascade of follow-on errors.
 *
 * Throws on an unrecoverable condition so the caller fails fast with one clear
 * message instead of twenty.
 */
async function ensureDatabaseExists(): Promise<void> {
  const target = resolveConnectionTarget()

  // SQLite, DynamoDB and unknown drivers have nothing to bootstrap.
  if (!target)
    return

  // Probe the TARGET first. On a locked-down managed instance the app user
  // often cannot open a maintenance database at all, so leading with
  // maintenance would fail even when the target exists and all was well.
  const probe = await probeTargetDatabase(target)
  if (probe.ok)
    return

  if (probe.kind !== 'missing-database')
    throw new Error(describeProbeFailure(target, probe.kind, probe.error))

  if (!mayCreateMissingDatabase()) {
    throw new Error(
      `The database "${target.database}" does not exist on ${describeTarget(target)}. `
      + `Create it with:  ${manualCreateHint(target)}`,
    )
  }

  const result = await createDatabase(target)

  if (!result.created && result.error) {
    throw new Error(
      `The database "${target.database}" does not exist on ${describeTarget(target)} `
      + `and it could not be created automatically. `
      + `${describeProbeFailure(target, result.kind, result.error)}\n`
      + `Create it yourself with:  ${manualCreateHint(target)}`,
    )
  }

  if (result.created) {
    // Name the database AND the server. Auto-creation turns a misconfigured
    // DB_DATABASE from a loud error into a silent side effect, so the one
    // thing we must never do is create it quietly.
    log.success(`Created database "${target.database}" on ${target.host}:${target.port}`)
  }
}

/** Set once the bootstrap has succeeded, so one process probes only once. */
let databaseBootstrapped = false

/**
 * Public bootstrap entry point.
 *
 * Call this before ANY other database work in a command. `migrate` reaches the
 * server from several independent places (auth tables, notification tables,
 * RBAC tables, the numbered migrations), and each one used to discover a
 * missing database on its own and report it separately, which is how a single
 * root cause turned into twenty lines of near-identical errors.
 *
 * Throws with one actionable message. Only a success is memoised, so a
 * transient failure can be retried in the same process.
 */
export async function ensureDatabaseReady(): Promise<void> {
  if (databaseBootstrapped)
    return

  await ensureDatabaseExists()
  databaseBootstrapped = true
}

/** Test seam: forget that the bootstrap already ran. */
export function resetDatabaseBootstrapCache(): void {
  databaseBootstrapped = false
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
    const { appModelClaimsTable, FEATURE_NAMES, migrationFeature, migrationTable } = await import('@stacksjs/buddy')
    const { feature: isFeatureEnabled } = await import('@stacksjs/config')
    const fs = await import('node:fs/promises')

    const migrationsDir = migrationDirectory()
    if (!existsSync(migrationsDir)) return hidden

    const disabledFeatures = new Set(
      (FEATURE_NAMES as readonly string[]).filter((f: string) => !(isFeatureEnabled as (name: string) => boolean)(f)),
    )
    if (disabledFeatures.size === 0) return hidden

    const files = readdirSync(migrationsDir).filter(f => f.endsWith('.sql'))
    const gatedTables = new Set<string>()
    for (const file of files) {
      const owner = (migrationFeature as (filename: string) => string | null)(file)
      if (!owner || !disabledFeatures.has(owner)) continue
      const table = (migrationTable as (filename: string) => string | null)(file)
      if (table && (appModelClaimsTable as (table: string) => boolean)(table)) continue
      if (table)
        gatedTables.add(table.toLowerCase())
      const original = join(migrationsDir, file)
      const hiddenPath = `${original}.disabled`
      await fs.rename(original, hiddenPath)
      hidden.push({ original, hidden: hiddenPath, feature: owner })
    }

    // A file the gate could not classify may still contain statements against
    // the tables it just hid — the catch-all `auto-misc` migration holds alters
    // for every table at once. Those statements are stripped for the duration
    // of the run and the original is put back afterwards.
    for (const file of files) {
      const filePath = join(migrationsDir, file)
      if (!existsSync(filePath)) continue
      const sql = readFileSync(filePath, 'utf8')
      const filtered = withoutGatedStatements(sql, gatedTables)
      if (filtered === sql) continue
      const backup = `${filePath}.ungated`
      await fs.rename(filePath, backup)
      writeFileSync(filePath, filtered)
      hidden.push({ original: filePath, hidden: backup, feature: 'mixed' })
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

/**
 * The table a single DDL statement acts on, or null when it names none.
 *
 * Only the forms the generator emits are recognised; anything unrecognised
 * comes back null and is therefore kept, which is the safe direction.
 */
export function statementTable(statement: string): string | null {
  const patterns = [
    /^\s*ALTER\s+TABLE\s+["`]?([a-z0-9_]+)["`]?/i,
    /^\s*CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?([a-z0-9_]+)["`]?/i,
    /^\s*DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?["`]?([a-z0-9_]+)["`]?/i,
    /^\s*CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?[a-z0-9_]+["`]?\s+ON\s+["`]?([a-z0-9_]+)["`]?/i,
  ]

  for (const pattern of patterns) {
    const match = pattern.exec(statement)
    if (match)
      return match[1]!.toLowerCase()
  }

  return null
}

/**
 * Drop the statements that act on a table a disabled feature owns.
 *
 * The generator emits a catch-all `auto-misc` migration holding stray alters
 * for every table at once. Its filename names no table, so the file-level gate
 * cannot classify it, and it ran in full: the first statement touching a gated
 * table failed with "relation ... does not exist" and took the whole migration
 * run with it. Gating has to reach inside a file that mixes them.
 *
 * A statement whose table cannot be identified is kept.
 */
export function withoutGatedStatements(sql: string, gated: ReadonlySet<string>): string {
  if (gated.size === 0)
    return sql

  const statements = sql.split(';').map(s => s.trim()).filter(Boolean)
  const kept = statements.filter((statement) => {
    const table = statementTable(statement)

    return !table || !gated.has(table)
  })

  if (kept.length === statements.length)
    return sql

  return kept.length === 0 ? '' : `${kept.join(';\n')};\n`
}

async function restoreHiddenMigrations(hidden: Array<{ original: string, hidden: string, feature: string }>): Promise<void> {
  const fs = await import('node:fs/promises')
  for (const { original, hidden: h } of hidden) {
    try {
      // A filtered file was written in place of the original, so it has to go
      // before the backup can take its name back.
      if (h.endsWith('.ungated'))
        await fs.rm(original, { force: true })

      await fs.rename(h, original)
    }
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
/**
 * How many migrations the target database has already recorded.
 *
 * Exported because regeneration must refuse to renumber a corpus that a live
 * database has bookkeeping against: the migrations table keys on the FILENAME,
 * so renaming files makes an applied migration look pending. One of them,
 * 0000000098-revoke-legacy-long-lived-tokens.sql, is a hard
 * `DELETE FROM oauth_access_tokens`, so a careless renumber re-runs a data wipe.
 */
export async function countAppliedMigrations(): Promise<number> {
  try {
    const row = await (db as any)
      .selectFrom('migrations')
      .select((eb: any) => eb.fn.count('id').as('n'))
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
    const dir = path.frameworkRuntimePath()
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
/**
 * Rewrite a migration's SQL to idempotent form (Postgres). `buddy generate` emits
 * plain `ADD COLUMN`/`ADD CONSTRAINT` alters, and the framework marks some as
 * "transient" (applied-but-not-recorded, then deleted) — so replaying them (a
 * re-run of `buddy migrate`, or a restored committed file) fails with
 * "column/constraint already exists". Making them idempotent removes that whole
 * class of failure:
 *   ADD COLUMN "x"        → ADD COLUMN IF NOT EXISTS "x"
 *   ADD CONSTRAINT "c" …  → DROP CONSTRAINT IF EXISTS "c"; ADD CONSTRAINT "c" …
 * The transform is itself idempotent (re-applying is a no-op) and only touches
 * ALTER statements; CREATE TABLE/INDEX already use IF NOT EXISTS.
 */
export function idempotentSql(sql: string): string {
  /*
   * The file's own header comes off the top first.
   *
   * `buddy generate:migrations` writes a `-- @generated by …` line, splitting
   * on `;` glues it to the first statement, and an anchored match then failed
   * on exactly one statement per file — the first. So the first constraint in
   * every generated migration was the one that never became idempotent, and
   * re-running the file failed with "already exists" on its own opening line.
   */
  const header = /^(?:[^\S\n]*--[^\n]*\n)+/.exec(sql)?.[0] ?? ''
  const stmts = sql.slice(header.length).split(';').map(s => s.trim()).filter(Boolean)
  if (stmts.length === 0)
    return sql
  const out: string[] = []
  for (const raw of stmts) {
    const stmt = raw.replace(/\bADD\s+COLUMN\s+(?!IF\s+NOT\s+EXISTS\b)/gi, 'ADD COLUMN IF NOT EXISTS ')
    const m = /^ALTER\s+TABLE\s+("?\w+"?)\s+ADD\s+CONSTRAINT\s+("?\w+"?)/i.exec(stmt)
    if (m) {
      const drops = [`ALTER TABLE ${m[1]} DROP CONSTRAINT IF EXISTS ${m[2]}`]

      /*
       * A foreign key added on a column that already has one has to displace
       * it, and the existing one is almost never under the name being added.
       *
       * A column declared `REFERENCES` inline in CREATE TABLE gets Postgres's
       * own name — `<table>_<column>_fkey` — while the generator emits
       * `<table>_<column>_fk`. Dropping only its own name leaves both in place,
       * and the stricter one wins every time they disagree: adding ON DELETE
       * CASCADE to a relation that shipped without it appeared to succeed and
       * changed nothing, because the original still refused the delete. A
       * migration that reports success is the worst place for this to hide.
       *
       * So drop the conventional name too. It is a no-op when nothing holds it.
       */
      const fk = /\bFOREIGN\s+KEY\s*\(\s*"?(\w+)"?\s*\)/i.exec(stmt)
      if (fk) {
        // Both captures exist by construction: the patterns that produced `m`
        // and `fk` each have a mandatory group, so a match implies a value.
        const table = m[1]!.replace(/"/g, '')
        drops.push(`ALTER TABLE ${m[1]} DROP CONSTRAINT IF EXISTS "${table}_${fk[1]}_fkey"`)
      }

      /*
       * Skipped only against the run of drops immediately preceding this ADD,
       * which is precisely the run this transform emitted last time.
       *
       * Scoping it that way keeps the transform a no-op on its own output —
       * `buddy migrate` rewrites these files on every run, so a transform that
       * grew the file would grow it without bound — while still emitting the
       * drops for a constraint that legitimately appears twice in one
       * migration, where skipping them would make the second ADD fail.
       */
      const already = new Set<string>()
      for (let i = out.length - 1; i >= 0; i--) {
        // In bounds by the loop condition.
        const previous = out[i]!
        if (!/^ALTER\s+TABLE\s+"?\w+"?\s+DROP\s+CONSTRAINT\b/i.test(previous))
          break
        already.add(previous.toUpperCase())
      }

      for (const drop of drops) {
        if (!already.has(drop.toUpperCase()))
          out.push(drop)
      }
    }
    out.push(stmt)
  }
  return `${header}${out.join(';\n')};\n`
}

/**
 * Rewrite every ALTER migration on disk to idempotent form (Postgres only) before
 * they run. Mirrors the `preprocessSqliteMigrations` file-rewrite pattern; runs
 * under the migration lock so concurrent runners can't race the disk. Skips files
 * with no ADD COLUMN/CONSTRAINT and files that are already idempotent.
 */
function makeMigrationsIdempotent(): void {
  const rewritten: string[] = []
  const migrationsDir = migrationDirectory('postgres')
  let files: string[]
  try {
    files = readdirSync(migrationsDir).filter(f => f.endsWith('.sql'))
  }
  catch {
    return
  }
  for (const f of files) {
    const p = join(migrationsDir, f)
    let sql: string
    try {
      sql = readFileSync(p, 'utf8')
    }
    catch {
      continue
    }
    const touchable = /\bADD\s+(?:COLUMN|CONSTRAINT)\b/i.test(sql)
      || /\bCREATE\s+TYPE\b/i.test(sql)
      || /\bALTER\s+COLUMN\b[^\n]*\bTYPE\b/i.test(sql)
    if (!touchable)
      continue

    // `CREATE TYPE` has no `IF NOT EXISTS`, so a corpus containing one could
    // only ever be applied to a database that had never seen it. Anything that
    // leaves the ledger behind the schema - an interrupted run, a restored
    // dump, a database built before the ledger existed - stopped `buddy
    // migrate` dead on the first enum, with an error naming a type that was
    // already exactly right.
    const next = orderPostgresColumnTypeChanges(guardPostgresEnumTypes(idempotentSql(sql)))
    if (next !== sql) {
      try {
        writeFileSync(p, next)
        rewritten.push(f)
      }
      catch { /* read-only fs — leave as-is */ }
    }
  }

  // These are git-tracked files, so rewriting them dirties the user's working
  // tree. It was logged at .debug, which is invisible by default, so the only
  // symptom was an unexplained diff appearing after every Postgres migrate.
  // Say it out loud until the transform moves in-memory.
  if (rewritten.length > 0) {
    log.warn(
      `[migration] Rewrote ${rewritten.length} migration file(s) on disk to be idempotent: ${rewritten.slice(0, 3).join(', ')}${rewritten.length > 3 ? `, +${rewritten.length - 3} more` : ''}. `
      + 'These files are tracked in git, so this shows up as a working-tree change.',
    )
  }
}

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

    // Ensure the database exists before running migrations (PostgreSQL/MySQL).
    // Memoised: the buddy command normally bootstrapped already.
    await ensureDatabaseReady()

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
    else if (dialect === 'postgres') {
      // Make ALTER migrations idempotent so re-runs / replays of "transient"
      // ADD COLUMN/CONSTRAINT alters don't fail on "already exists".
      makeMigrationsIdempotent()
    }

    const modelsDir = path.userModelsPath()

    /*
     * Some older generated migration corpora rebuild or normalize framework
     * notification tables but never contain their original CREATE TABLE. On a
     * fresh database those statements fail before the post-batch guarantee can
     * run. Pre-create only the tables the corpus does not declare itself, so a
     * model-owned CREATE remains authoritative over its full schema and keys.
     */
    const migrationsDir = migrationDirectory()
    let migrationSql = ''
    try {
      migrationSql = readdirSync(migrationsDir)
        .filter(file => file.endsWith('.sql'))
        .sort()
        .map(file => readFileSync(join(migrationsDir, file), 'utf8'))
        .join('\n')
    }
    catch {
      // A missing migration directory is a valid first-run state. The normal
      // post-batch guarantee below still creates the framework tables.
    }

    if (migrationSql) {
      const preflightTables = notificationTablesMissingCreateStatements(migrationSql)
      if (preflightTables.length > 0) {
        const preflight = await migrateNotificationTables({ tables: preflightTables })
        if (!preflight.success)
          throw new Error(preflight.error || 'Failed to prepare notification tables before migrations')
      }
    }

    // Count applied-before so we can compute the delta after the
    // migration run. Lets the buddy CLI distinguish "nothing to
    // migrate" from "applied N" in the outro (user-reported
    // messaging gap).
    const appliedBefore = await countAppliedMigrations()

    // Execute existing migration files
    log.debug(`[migration] Running migrations from: ${modelsDir}`)
    await qbExecuteMigration(modelsDir)

    // Complete the guarantee after the model batch. This creates tables absent
    // from both the corpus and the preflight, and validates existing shapes.
    const notificationTables = await migrateNotificationTables()
    if (!notificationTables.success)
      throw new Error(notificationTables.error || 'Failed to prepare notification tables')

    /*
     * The notification foreign keys, now that `users` is certain to exist.
     *
     * The conditional preflight can create a table before the batch when an
     * older corpus references it without declaring it. Those framework tables
     * intentionally start without user foreign keys because `users` may not
     * exist yet. Model-owned tables skip the preflight and retain the inline
     * keys from their own CREATE statements.
     *
     * Same shape as `ensureUsersAuthColumns` being called a second time after
     * the numbered migrations, and for the same reason.
     */
    await ensureNotificationForeignKeys()

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

    // A constraint violation is about the *data*, so `migrate:fresh` is the
    // one thing that cannot help: it replays the same DDL against the same
    // seeded rows and fails identically, having destroyed the database on the
    // way. Recommending it here sent people round a loop whose only exit was
    // deleting the SQLite file by hand.
    //
    // The index-named form (`index 'x'` rather than `table.column`) is worth
    // calling out separately: SQLite only phrases it that way for an
    // expression index or a 12-step table rebuild, so a plain
    // `CREATE UNIQUE INDEX` over duplicate values is *not* what happened, and
    // looking for duplicates in the obvious place will waste an afternoon.
    if (/UNIQUE constraint failed/i.test(detail)) {
      const viaIndex = /index\s+'/i.test(detail)
      log.info(
        '[migration] This is a data conflict, not a schema one - `migrate:fresh` replays the same '
        + 'statements against the same rows and fails the same way. Clear or de-duplicate the '
        + 'offending rows first.',
      )
      if (viaIndex) {
        log.info(
          '[migration] The error names an index rather than a column, which SQLite only does for an '
          + 'expression index or a table rebuild - so the conflict is arising while rows are being '
          + 'copied, not from a bare CREATE UNIQUE INDEX.',
        )
      }
    }
    else {
      log.info('[migration] Run `./buddy migrate:fresh` to drop and recreate the schema if state is partial.')
    }

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
    // Bootstrap BEFORE dropping anything. `migrate:fresh` calls this function
    // first and only reached ensureDatabaseExists() later, from inside
    // runDatabaseMigration(), so a missing database produced eight
    // "Could not drop table X: database ... does not exist" warnings before
    // anything checked whether the database was there at all.
    await ensureDatabaseReady()

    // Configure bun-query-builder with stacks database settings
    configureQueryBuilder()

    const modelsDir = path.userModelsPath()
    const dialect = getDialect()

    // Drop framework tables first (OAuth, passkeys, etc.)
    await dropFrameworkTables(dialect)

    // Then drop user model tables. A vendored framework checkout has no
    // userland app/Models, and bun-query-builder's resetDatabase() answers a
    // missing directory by printing a raw ENOENT stack and then reporting
    // "-- Database reset completed successfully" regardless. Skip the call
    // rather than let it narrate a failure as a success.
    if (existsSync(modelsDir)) {
      await qbResetDatabase(modelsDir, { dialect, preserveMigrationState: true })
    }
    else {
      log.debug(`No models directory at ${modelsDir}; skipping model table drops.`)
    }

    // The framework's own default models have tables in this database too, and
    // leaving them standing is not merely untidy: their Postgres enum types
    // survive with them, and the replay that follows tries to create a type
    // that is still there and dies on the first one it reaches. `fresh` has to
    // mean the whole schema the framework put there, not just the app's half.
    const defaultsDir = defaultModelsPath()
    if (existsSync(defaultsDir))
      await qbResetDatabase(defaultsDir, { dialect, preserveMigrationState: true })
    else
      log.debug(`No framework default models directory at ${defaultsDir}; skipping.`)

    // Postgres enum types outlive the tables that used them: `DROP TABLE`
    // leaves the type behind, and the replay that follows tries to create it
    // again and fails with "type ... already exists". A reset that leaves the
    // database unable to migrate is not a reset.
    if (dialect === 'postgres')
      await dropOrphanedEnumTypes()

    return ok('All tables dropped successfully!')
  }
  catch (error) {
    return err(handleError('Database reset failed', error))
  }
}

/**
 * Drop every enum type no surviving column still uses.
 *
 * Types belonging to tables that were kept are left alone, so this stays safe
 * to call against a database that shares a schema with something else.
 */
async function dropOrphanedEnumTypes(): Promise<void> {
  try {
    const rows = await (db as any).unsafe(`
      SELECT t.typname AS name
      FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE t.typtype = 'e'
        AND n.nspname = current_schema()
        AND NOT EXISTS (
          SELECT 1 FROM pg_attribute a
          JOIN pg_class c ON c.oid = a.attrelid
          WHERE a.atttypid = t.oid AND c.relkind = 'r' AND NOT a.attisdropped
        )
    `).execute()

    const names: string[] = (Array.isArray(rows) ? rows : (rows?.rows ?? []))
      .map((row: any) => String(row.name ?? row.typname ?? ''))
      .filter(Boolean)

    for (const name of names) {
      try {
        await (db as any).unsafe(`DROP TYPE IF EXISTS "${name}" CASCADE`).execute()
        log.debug(`Dropped orphaned enum type: ${name}`)
      }
      catch (error) {
        log.warn(`Could not drop enum type ${name}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  }
  catch (error) {
    // Listing types is best effort: a database that refuses the catalog query
    // still deserves the table drops it already got.
    log.warn(`Could not list enum types to drop: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * Drop framework-managed tables (OAuth, passkeys, jobs, etc.)
 */
async function dropFrameworkTables(dialect: 'sqlite' | 'mysql' | 'vitess' | 'postgres'): Promise<void> {
  // Disable foreign key checks for MySQL to avoid constraint issues
  if (dialect === 'mysql' || dialect === 'vitess') {
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
      else if (dialect === 'mysql' || dialect === 'vitess') {
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
      // A connection-level failure (database gone, server down, credentials
      // rejected) repeats identically for every remaining table. Surface it
      // once and stop, rather than printing the same sentence eight times and
      // then reporting the reset as successful.
      const kind = classifyConnectionError(error)
      if (kind === 'missing-database' || kind === 'missing-role' || kind === 'auth-failed' || kind === 'server-unreachable' || kind === 'timeout')
        throw error

      // Anything else is table-specific, most often that it never existed.
      log.warn(`Could not drop table ${tableName}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // Re-enable foreign key checks for MySQL
  if (dialect === 'mysql' || dialect === 'vitess') {
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
 * out to a fresh file in the active dialect's migration corpus. Each statement is
 * grouped by table + DDL verb and lands in its own file using the
 * runner's existing naming convention so it picks them up the same way
 * as a hand-written migration.
 *
 * Without this write step the qb generator stages the diff in memory but
 * the runner never sees it, so model edits silently no-op'd — defeating
 * the "models are the source of truth" promise.
 */
export interface GenerateMigrationsOptions {
  /**
   * Emit data-preserving `RENAME COLUMN` for unambiguous detected renames
   * (default true). False forces literal DROP + ADD. Falls back to the
   * `STACKS_MIGRATE_NO_RENAME` env flag (set by the `buddy migrate` command
   * across the action subprocess boundary).
   */
  applyRenames?: boolean
  /**
   * Diff against the live database instead of the snapshot. Falls back to the
   * `STACKS_MIGRATE_FROM_DB` env flag.
   */
  fromDb?: boolean
}

function resolveGenerateOptions(options: GenerateMigrationsOptions): { applyRenames?: boolean, fromDb?: boolean } {
  const applyRenames = options.applyRenames ?? (process.env.STACKS_MIGRATE_NO_RENAME === '1' ? false : undefined)
  const fromDb = options.fromDb ?? (process.env.STACKS_MIGRATE_FROM_DB === '1' ? true : undefined)
  return { applyRenames, fromDb }
}

/**
 * Preview the pending migration as a list of structured operations WITHOUT
 * writing any files or advancing the snapshot. The `buddy migrate` command
 * uses this (in the interactive parent process) to gate destructive changes
 * behind confirmation before spawning the non-interactive migrate action.
 */
export async function previewPendingMigrations(options: GenerateMigrationsOptions = {}): Promise<MigrationOperation[]> {
  try {
    configureQueryBuilder()
    const dialect = getDialect()
    const { modelsDir, skip, protectedTables } = prepareMigrationModelsDir()
    if (skip)
      return []
    const { applyRenames, fromDb } = resolveGenerateOptions(options)
    const qbDialect = getQbDialect()
    const result = await qbGenerateMigration(modelsDir, {
      dialect: qbDialect,
      vitessSharded: qbDialect === 'vitess' ? isVitessSharded(dbConfig.connections.vitess.sharded) : undefined,
      dryRun: true,
      applyRenames,
      fromDb,
    })
    let operations = result.operations ?? []
    // Protected tables are never dropped (see `withoutProtectedTableDropSql`),
    // so they must not appear in the confirmation gate either — sixty phantom
    // drops would train the user to approve a prompt that is, on any other run,
    // worth reading.
    if (protectedTables.length > 0) {
      const excluded = new Set(protectedTables.map(table => table.toLowerCase()))
      operations = operations.filter(
        (op: MigrationOperation) => !(op.kind === 'drop_table' && excluded.has(op.table.toLowerCase())),
      )
    }
    // Framework-managed columns (trait ALTERs, not model `attributes`) are not
    // real strays — don't surface them as destructive drops in the confirmation
    // gate, or migrate never shows "nothing to migrate" (stacksjs/stacks#2075).
    if (!operations.some((op: MigrationOperation) => op.kind === 'drop_column'))
      return operations
    return withoutManagedColumnDrops(operations, await frameworkManagedColumns())
  }
  catch (error) {
    // A preview must never block the migrate flow on its own failure — the
    // real generate (with proper error handling) runs right after.
    log.debug(`[migration] preview failed: ${error instanceof Error ? error.message : String(error)}`)
    return []
  }
}

/**
 * Where bun-query-builder keeps its model snapshots.
 *
 * It writes to `snapshotDir` (default `.qb`), so this has to read from the same
 * place or the mismatch guard silently checks an empty directory and stops
 * guarding anything. Stacks points it at `storage/framework/database` to keep
 * generated framework state out of the project root.
 */
function snapshotDirLabel(): string {
  return (qbConfig as { snapshotDir?: string } | undefined)?.snapshotDir || qbSnapshotDir()
}

function resolveSnapshotDir(): string {
  const label = snapshotDirLabel()
  // `snapshotDirLabel()` is whatever was handed to `setConfig`, which is already
  // relativised for the library's own `join`. Resolving it the same way keeps
  // reads and writes on the same directory even when it lives outside the
  // release, which is the point of DB_SNAPSHOT_PATH (stacksjs/stacks#2351).
  return isAbsolute(label) ? label : resolve(process.cwd(), label)
}

function snapshotPathFor(dialect: string): string {
  return join(resolveSnapshotDir(), `model-snapshot.${dialect}.json`)
}

function readStoredMigrationPlan(dialect: string): MigrationPlan | undefined {
  const snapshotPath = snapshotPathFor(dialect)
  if (!existsSync(snapshotPath))
    return undefined

  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(snapshotPath, 'utf8'))
  }
  catch (error) {
    throw new Error(
      `The migration snapshot is not valid JSON: ${snapshotPath}. Repair or regenerate it before creating migrations.`,
      { cause: error },
    )
  }

  const candidate = parsed && typeof parsed === 'object' && 'plan' in parsed
    ? (parsed as { plan?: unknown }).plan
    : parsed
  if (!candidate || typeof candidate !== 'object' || !Array.isArray((candidate as { tables?: unknown }).tables)) {
    throw new TypeError(
      `The migration snapshot has an invalid structure: ${snapshotPath}. Repair or regenerate it before creating migrations.`,
    )
  }

  return candidate as MigrationPlan
}

export function preserveMigrationPlanTableOrder(
  next: MigrationPlan,
  previous?: MigrationPlan,
): MigrationPlan {
  const orderedByPrevious = <T>(
    values: T[],
    previousValues: T[] | undefined,
    keyFor: (value: T) => string,
  ): T[] => {
    if (!previousValues)
      return [...values]
    const previousOrder = new Map(previousValues.map((value, index) => [keyFor(value), index]))
    const nextOrder = new Map(values.map((value, index) => [keyFor(value), index]))
    const previousCount = previousValues.length
    return [...values].sort((left, right) => {
      const leftKey = keyFor(left)
      const rightKey = keyFor(right)
      const leftOrder = previousOrder.get(leftKey) ?? previousCount + nextOrder.get(leftKey)!
      const rightOrder = previousOrder.get(rightKey) ?? previousCount + nextOrder.get(rightKey)!
      return leftOrder - rightOrder
    })
  }

  const previousTables = new Map(previous?.tables.map(table => [table.table, table]) ?? [])
  const tables = next.tables.map((table) => {
    const previousTable = previousTables.get(table.table)
    const previousColumns = new Map(previousTable?.columns.map(column => [column.name, column]) ?? [])
    return {
      ...table,
      columns: orderedByPrevious(
        table.columns.map((column) => {
          if (
            next.dialect !== 'sqlite'
            || !column.enumTypeName
            || previousColumns.get(column.name)?.enumTypeName
          ) {
            return column
          }
          const portableColumn = { ...column }
          delete portableColumn.enumTypeName
          return portableColumn
        }),
        previousTable?.columns,
        column => column.name,
      ),
      indexes: orderedByPrevious(table.indexes, previousTable?.indexes, index => index.name),
    }
  })

  return {
    ...next,
    tables: orderedByPrevious(tables, previous?.tables, table => table.table),
  }
}

/**
 * Detect a dialect/snapshot mismatch in the snapshot directory. Returns the
 * name of an existing snapshot's dialect when the resolved `dialect` has no
 * snapshot of its own but some OTHER dialect does — the signature of a
 * misconfigured environment that would make `generateMigrations` emit a
 * duplicate migration set. Returns null when there is no snapshot directory yet
 * (fresh project — nothing to protect) or when the resolved dialect already has
 * history.
 */
function detectSnapshotDialectMismatch(dialect: string): string | null {
  const qbDir = resolveSnapshotDir()
  let files: string[]
  try {
    files = readdirSync(qbDir)
  }
  catch {
    return null // no snapshot dir yet — first-ever generate, nothing to clobber
  }
  const snapshotFor = (d: string): string => `model-snapshot.${d}.json`
  if (files.includes(snapshotFor(dialect)))
    return null // resolved dialect already has a snapshot — normal incremental generate
  for (const f of files) {
    const m = /^model-snapshot\.(\w+)\.json$/.exec(f)
    if (m?.[1] && m[1] !== dialect)
      return m[1]
  }
  return null // no snapshots at all for any dialect — nothing to conflict with
}

export async function generateMigrations(options: GenerateMigrationsOptions = {}): Promise<Result<string, Error>> {
  try {
    // Step-progress at debug — buddy's intro/outro carries the user-
    // visible signal. On a no-op generate we want zero lines between
    // those two; on a real generate the per-file written count below
    // is the meaningful breadcrumb.
    log.debug('Generating migrations...')

    // Configure bun-query-builder with stacks database settings
    configureQueryBuilder()

    const dialect = getDialect()

    // Guard against the dialect footgun (stacksjs/stacks#1927): the qb generator
    // diffs models against `<snapshotDir>/model-snapshot.<dialect>.json`. If the
    // resolved dialect has NO snapshot but another dialect does, the environment is almost
    // certainly misconfigured — most commonly there is no `.env`, so
    // `DB_CONNECTION` defaults to 'sqlite' even though the project's committed
    // migrations + snapshot are Postgres. Generating anyway emits a FULL, second
    // migration set in the wrong dialect (the per-statement dedup in
    // persistGeneratedMigrations is textual and can't match across dialects), which
    // silently collides with the committed migrations. Refuse loudly instead of
    // clobbering; the fix is to set DB_CONNECTION (or add the `.env`).
    const mismatch = detectSnapshotDialectMismatch(dialect)
    const flatMigrationDir = join(process.cwd(), 'database', 'migrations')
    if (mismatch && migrationDirectory(dialect) === flatMigrationDir) {
      const snapshotDir = snapshotDirLabel()
      return err(new Error(
        `Refusing to generate migrations: resolved dialect "${dialect}" has no snapshot in `
        + `${snapshotDir}/, but "${mismatch}" does. DB_CONNECTION is likely unset or wrong `
        + `(missing .env?) - generating now would write a full duplicate migration set in the `
        + `wrong dialect. Set DB_CONNECTION=${mismatch} (or your intended dialect) and retry. To `
        + `intentionally start a new dialect from scratch, remove `
        + `${snapshotDir}/model-snapshot.${mismatch}.json first.`,
      ))
    }
    const storedPlan = readStoredMigrationPlan(getQbDialect())

    const { modelsDir, skip, excludedTables, protectedTables } = prepareMigrationModelsDir()
    if (skip) {
      log.debug('No app/Models directory found; using committed framework migrations')
      return ok('Migrations generated')
    }

    const { applyRenames, fromDb } = resolveGenerateOptions(options)
    log.debug(`[migration] Generating migrations for dialect: ${dialect}, models: ${modelsDir}`)
    // The first question asked when an expected table doesn't generate. Cheap
    // to leave in, and it names the flag that answers it.
    if (excludedTables.length > 0) {
      log.debug(
        `[migration] ${excludedTables.length} framework default model(s) out of scope because app/Models defines this app's schema. `
        + `Enable database.models.includeFrameworkDefaults (or STACKS_INCLUDE_FRAMEWORK_MODELS=1) to generate them too.`,
      )
    }
    // dryRun: true — bun-query-builder's own file writer numbers migrations
    // from its own internal counter (1, 2, 3, ...), unaware of any already-
    // committed migration files. On a project with existing migrations that
    // collided with committed files (e.g. a fresh 0000000001-*.sql next to
    // the real 0000000001-*.sql), and `persistGeneratedMigrations` below —
    // which numbers correctly, continuing from the highest existing file —
    // then saw its own content already on disk and silently skipped writing
    // anything. Keeping the qb call dry-run makes `persistGeneratedMigrations`
    // the single place that ever writes a migration file.
    const qbDialect = getQbDialect()
    const result = await qbGenerateMigration(modelsDir, {
      dialect: qbDialect,
      vitessSharded: qbDialect === 'vitess' ? isVitessSharded(dbConfig.connections.vitess.sharded) : undefined,
      dryRun: true,
      applyRenames,
      fromDb,
    })

    // Never write a migration that drops a framework-managed column: those are
    // guaranteed by runtime ALTERs (ensureUsersAuthColumns / ensureUuidColumns),
    // not the model, so the differ re-proposes dropping them every run and a
    // stray `y` destroys auth/billing data (stacksjs/stacks#2075).
    let sqlStatements = result.sqlStatements ?? []
    if (dialect === 'sqlite')
      sqlStatements = inlineSqliteAddedColumnReferences(sqlStatements, result.plan)
    if (result.hasChanges && sqlStatements.length > 0) {
      const filtered = withoutManagedColumnDropSql(sqlStatements, await frameworkManagedColumns(), result.operations ?? [])
      if (filtered.removed.length > 0)
        log.debug(`[migration] Skipped ${filtered.removed.length} generated drop(s) of framework-managed column(s) (stacksjs/stacks#2075)`)
      sqlStatements = filtered.statements
    }

    // Same idea one level up: framework defaults that are out of scope because
    // this app has its own models must not be read as tables the app deleted,
    // and neither must the trait pivots that left scope alongside them.
    // Said out loud rather than at debug — an app upgrading into #2220's fix
    // sees its table count fall by sixty, and should know why nothing dropped.
    if (result.hasChanges && sqlStatements.length > 0 && protectedTables.length > 0) {
      const filtered = withoutProtectedTableDropSql(sqlStatements, protectedTables, result.operations ?? [])
      if (filtered.removed.length > 0) {
        log.info(
          `[migration] Left ${filtered.removed.length} framework-owned table(s) in place rather than dropping them. `
          + `They are no longer generated because app/Models defines this app's schema; the tables and their data are untouched. `
          + `Set database.models.includeFrameworkDefaults to keep generating them (stacksjs/stacks#2220).`,
        )
      }
      sqlStatements = filtered.statements
    }

    // An ALTER that names an enum type nothing creates cannot run, and writing
    // it means every later `migrate` stops there. bun-query-builder qualifies an
    // enum type as `<table>_<column>_type` when it creates the table but has
    // emitted the bare `<column>_type` on the ALTER path, so a diff touching an
    // existing enum column produces exactly that. Dropping those statements
    // leaves the column as it is, which is what it already was.
    if (result.hasChanges && sqlStatements.length > 0) {
      const dangling = findDanglingTypeReferences(sqlStatements)
      if (dangling.length > 0) {
        // Create the type rather than dropping the statement that needs it.
        // The values are in the plan - the model declared them - so the enum
        // this ALTER wants can simply be defined ahead of it. Dropping the
        // statement left the column as whatever it already was, which meant a
        // model change silently did not happen.
        const created = createMissingEnumTypes(dangling, result.plan)
        if (created.statements.length > 0) {
          sqlStatements = [...created.statements, ...sqlStatements]
          log.debug(`[migration] Created ${created.statements.length} enum type(s) an ALTER needed: ${created.defined.join(', ')}`)
        }

        // Anything still undefined has no values to build it from, and an ALTER
        // naming a type nothing creates cannot run - it would stop every later
        // migration at that file. Those are still dropped, and still said out
        // loud, because the column keeps whatever it already was.
        const unresolved = dangling.filter(name => !created.defined.includes(name))
        if (unresolved.length > 0) {
          const before = sqlStatements.length
          sqlStatements = sqlStatements.filter((statement: string) => !referencesUndefinedType(statement, unresolved))
          log.warn(
            `[migration] Skipped ${before - sqlStatements.length} generated statement(s) referencing enum type(s) `
            + `nothing creates and no model defines values for (${unresolved.slice(0, 3).join(', ')}${unresolved.length > 3 ? ', …' : ''}).`,
          )
        }
      }
    }

    // A userland model replaces a framework default rather than extending it,
    // so a model written without knowing the framework ships one of the same
    // name generates a migration that drops that table's columns while the
    // framework's own code goes on reading them. Refused rather than written:
    // this one applies cleanly and says nothing until a page that has always
    // worked stops finding a column. See `shadowed-models.ts`.
    if (result.hasChanges && sqlStatements.length > 0 && !shadowDropsAllowed()) {
      const shadowed = resolveModelSources()?.shadowed ?? []
      const drops = findShadowedColumnDrops(sqlStatements, shadowed)

      if (drops.length > 0)
        return err(new Error(shadowedDropMessage(drops)))
    }

    if (result.hasChanges) {
      const written = persistGeneratedMigrations(sqlStatements)
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

    // BQB is intentionally called in dry-run mode because Stacks owns file
    // naming/persistence. Advance its model snapshot only after that writer
    // succeeds, otherwise every run diffs against stale model state and model
    // removals can never be observed.
    const stablePlan = preserveMigrationPlanTableOrder(result.plan, storedPlan)
    if (!storedPlan || JSON.stringify(stablePlan) !== JSON.stringify(storedPlan))
      saveMigrationSnapshot(stablePlan, { dialect: getQbDialect() })
    else
      log.debug('Model snapshot unchanged')

    return ok('Migrations generated')
  }
  catch (error) {
    /*
     * The cause, in the message.
     *
     * `handleError` records the underlying error in the log and returns a
     * `Error` whose message is the summary - so a caller that prints the result
     * gets "Migration generation failed" and nothing about *what* failed. That
     * is a sentence somebody debugs for an hour: the real answer is usually one
     * Postgres line, and it was three frames away the whole time.
     */
    const because = error instanceof Error ? error.message : String(error)

    return err(handleError(`Migration generation failed: ${because}`, error))
  }
}

/**
 * Write generated SQL to the active dialect's corpus so the runner picks it up.
 * Returns the number of files written.
 */
/**
 * Enum types a generated corpus USES but never DEFINES.
 *
 * Postgres enums have to exist before a column can be typed with them, so a
 * dangling reference is a guaranteed mid-migration failure rather than a
 * cosmetic problem.
 */

/**
 * Whether a statement references one of the enum types nothing creates.
 *
 * Matches on the quoted name so a column or table that merely contains the same
 * word is not caught.
 */
export function referencesUndefinedType(statement: string, dangling: string[]): boolean {
  return dangling.some(name => statement.includes(`"${name}"`))
}

export function findDanglingTypeReferences(statements: string[]): string[] {
  const defined = new Set<string>()
  const referenced = new Set<string>()

  for (const statement of statements) {
    for (const match of statement.matchAll(/CREATE\s+TYPE\s+"([^"]+)"/gi))
      defined.add(match[1]!)

    // `ALTER COLUMN "x" TYPE "y"` and `"col" "y" not null` both land here; only
    // quoted names are considered, so built-ins like bigint are never flagged.
    for (const match of statement.matchAll(/\bTYPE\s+"([^"]+)"/gi))
      referenced.add(match[1]!)
  }

  return [...referenced].filter(name => !defined.has(name)).sort()
}

interface MigrationPlanColumn {
  name?: string
  references?: {
    table?: string
    column?: string
  }
  enumValues?: string[]
}

/**
 * Define the enum types an ALTER needs but nothing in the batch creates.
 *
 * Postgres enum columns are backed by a named type, and bun-query-builder names
 * it `<table>_<column>_type` when it creates the table. A column that becomes an
 * enum *later* gets an `ALTER … TYPE "<table>_<column>_type"` naming a type that
 * was never created, because the `CREATE TYPE` only ever accompanied a
 * `CREATE TABLE`.
 *
 * The values are right there in the plan - the model declared them - so the type
 * can be created instead of the statement being thrown away. Throwing it away
 * left the column as it was, so a model change quietly did not happen and the
 * next diff proposed the same thing again forever.
 */
export function createMissingEnumTypes(
  dangling: string[],
  plan: MigrationPlanLike | undefined,
): { statements: string[], defined: string[] } {
  if (dangling.length === 0)
    return { statements: [], defined: [] }

  // Every enum column in the plan, keyed by the type name the driver would use.
  const values = new Map<string, string[]>()
  for (const table of plan?.tables ?? []) {
    if (!table.table)
      continue
    for (const column of table.columns ?? []) {
      if (!column.name || !column.enumValues?.length)
        continue
      values.set(`${table.table}_${column.name}_type`, column.enumValues)
    }
  }

  const statements: string[] = []
  const defined: string[] = []

  for (const name of dangling) {
    const members = values.get(name)
    if (!members?.length)
      continue

    // `IF NOT EXISTS` is not available on CREATE TYPE, so the guard is a DO
    // block: the type may already exist on a database that ran an earlier
    // version of this migration, and failing there would stop the run.
    const literals = members.map(member => `'${String(member).replaceAll('\'', '\'\'')}'`).join(', ')
    // The guard terminates what it emits when it appends the `ADD VALUE`
    // assertions, so the `;` is only added when it is missing. Adding it
    // unconditionally left an empty statement at the end of the file.
    const guarded = guardPostgresEnumTypes(`CREATE TYPE "${name}" AS ENUM (${literals})`)
    statements.push(guarded.endsWith(';') ? guarded : `${guarded};`)
    defined.push(name)
  }

  return { statements, defined }
}

interface MigrationPlanTable {
  table?: string
  columns?: MigrationPlanColumn[]
}

interface MigrationPlanLike {
  tables?: MigrationPlanTable[]
}

/**
 * SQLite supports a nullable foreign key on `ADD COLUMN`, but not a later
 * `ADD CONSTRAINT`. bun-query-builder emits the new relation column without
 * its reference on incremental SQLite diffs, leaving the live schema weaker
 * than the model. Recover the reference from the generated current plan and
 * declare it inline while the column is added.
 */
export function inlineSqliteAddedColumnReferences(
  statements: string[],
  plan: MigrationPlanLike | undefined,
): string[] {
  const references = new Map<string, { table: string, column: string }>()

  for (const table of plan?.tables ?? []) {
    if (!table.table)
      continue
    for (const column of table.columns ?? []) {
      const reference = column.references
      if (!column.name || !reference?.table || !reference.column)
        continue
      references.set(`${table.table}.${column.name}`, {
        table: reference.table,
        column: reference.column,
      })
    }
  }

  if (references.size === 0)
    return statements

  return statements.map((statement) => {
    if (/\bREFERENCES\b/i.test(statement))
      return statement

    const match = statement.match(/^(\s*ALTER\s+TABLE\s+["`]?(\w+)["`]?\s+ADD\s+COLUMN\s+["`]?(\w+)["`]?\s+)([\s\S]*?)(;?\s*)$/i)
    const reference = match?.[2] && match[3]
      ? references.get(`${match[2]}.${match[3]}`)
      : undefined
    if (!match || !reference)
      return statement

    return `${match[1]}${match[4]!.trimEnd()} REFERENCES "${reference.table}"("${reference.column}")${match[5]}`
  })
}

/**
 * Header stamped onto every file `regenerateMigrationCorpus` writes.
 *
 * It is the only thing that distinguishes a file the generator can recreate
 * from one a person wrote. Without it, "rebuild the corpus from the models"
 * deleted migrations that no model describes and no rerun could ever bring
 * back — a `DROP COLUMN` enforcing a privacy invariant, say
 * (stacksjs/stacks#2234).
 *
 * A leading comment is safe to prepend: `sqlStatementsOf` strips comments
 * before splitting on `;`, precisely so a file that opens with a header does
 * not glue it onto the first statement.
 */
export const GENERATED_MIGRATION_MARKER = [
  // The runner's own marker, first because it is only recognized at the very
  // start of the file.
  //
  // These files are executed by `bun-query-builder`, which keeps its own idea
  // of which migrations it generated: a generated file whose change is already
  // in place is recorded and skipped, and an authored one fails loudly. Two
  // markers for one corpus meant every file this generator wrote read as
  // hand-authored to the tool running it, so MySQL - which has no
  // `ADD CONSTRAINT IF NOT EXISTS` - stopped the whole corpus on a foreign key
  // that was already there.
  'qb:generated',
  '@generated by `buddy migrate:regenerate` - edits will be overwritten',
].map(line => `-- ${line}`).join('\n')

/** Whether a migration file was emitted by the corpus generator. */
export function isGeneratedMigration(dir: string, file: string): boolean {
  try {
    // The marker sits at the head of the file - `qb:generated` first, this note
    // on the line under it - so only the head needs reading.
    return readFileSync(join(dir, file), 'utf8').slice(0, 200).includes('@generated by `buddy migrate:regenerate`')
  }
  catch {
    // Unreadable means "cannot prove it is ours", which must mean "keep it".
    return false
  }
}

/**
 * The tables a statement ACTS ON — the target of a CREATE/ALTER/DROP TABLE or
 * a CREATE INDEX.
 *
 * Deliberately not "every table the statement mentions". A `REFERENCES users`
 * in a foreign key makes `users` a table the statement depends on, not one it
 * changes, and counting it would tie half the corpus to whatever table the app
 * happens to point its foreign keys at.
 */
export function tablesOperatedOn(sql: string): string[] {
  const tables = new Set<string>()

  for (const statement of sqlStatementsOf(sql)) {
    const stmt = statement.trim()
    const direct = stmt.match(/^(?:CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?|ALTER\s+TABLE|DROP\s+TABLE(?:\s+IF\s+EXISTS)?|TRUNCATE\s+TABLE)\s+["'`]?(\w+)["'`]?/i)
    if (direct?.[1]) {
      tables.add(direct[1].toLowerCase())
      continue
    }

    const index = stmt.match(/^CREATE\s+(?:UNIQUE\s+)?INDEX(?:\s+IF\s+NOT\s+EXISTS)?\s+\S+\s+ON\s+["'`]?(\w+)["'`]?/i)
    if (index?.[1])
      tables.add(index[1].toLowerCase())
  }

  return [...tables]
}

/**
 * The columns a CREATE TABLE statement defines, in order.
 *
 * Splits on top-level commas only, so `DECIMAL(10, 2)` and a multi-column
 * `PRIMARY KEY (a, b)` do not read as column boundaries. Table constraints
 * carry no column name and are skipped.
 */
export function columnsDefinedByCreate(statement: string): string[] {
  const body = statement.match(/^\s*CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["'`]?\w+["'`]?\s*\(([\s\S]*)\)\s*;?\s*$/i)?.[1]
  if (!body)
    return []

  const parts: string[] = []
  let depth = 0
  let current = ''

  for (const char of body) {
    if (char === '(')
      depth++
    if (char === ')')
      depth--
    if (char === ',' && depth === 0) {
      parts.push(current)
      current = ''
      continue
    }
    current += char
  }
  parts.push(current)

  const constraint = /^\s*(?:PRIMARY\s+KEY|FOREIGN\s+KEY|UNIQUE|CHECK|CONSTRAINT|KEY|INDEX)\b/i

  return parts
    .map(part => part.trim())
    .filter(part => part && !constraint.test(part))
    .flatMap(part => part.match(/^["'`]?(\w+)["'`]?/)?.[1] ?? [])
}

/**
 * Which columns of `table` the migrations on disk actually produce.
 *
 * This is "what a database would have after running the corpus", which is not
 * the same as what the models declare - and the gap between those two is the
 * bug this exists to close.
 */
export function columnsProducedByMigrations(dir: string, files: readonly string[], table: string): Set<string> {
  const columns = new Set<string>()
  const target = table.toLowerCase()

  for (const file of [...files].sort()) {
    let content: string
    try {
      content = readFileSync(join(dir, file), 'utf8')
    }
    catch {
      continue
    }

    for (const statement of sqlStatementsOf(content)) {
      const stmt = statement.trim()

      const create = stmt.match(/^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["'`]?(\w+)["'`]?/i)
      if (create?.[1]?.toLowerCase() === target) {
        for (const column of columnsDefinedByCreate(stmt))
          columns.add(column.toLowerCase())
        continue
      }

      const added = stmt.match(/^ALTER\s+TABLE\s+["'`]?(\w+)["'`]?\s+ADD\s+(?:COLUMN\s+)?["'`]?(\w+)["'`]?/i)
      if (added?.[1]?.toLowerCase() === target && added[2])
        columns.add(added[2].toLowerCase())

      const dropped = stmt.match(/^ALTER\s+TABLE\s+["'`]?(\w+)["'`]?\s+DROP\s+(?:COLUMN\s+)?["'`]?(\w+)["'`]?/i)
      if (dropped?.[1]?.toLowerCase() === target && dropped[2])
        columns.delete(dropped[2].toLowerCase())

      // A SQLite rebuild replaces the table wholesale: whatever the temp table
      // defines is what the real one ends up with.
      const rebuilt = stmt.match(/^ALTER\s+TABLE\s+["'`]?_qb_tmp_(\w+)["'`]?\s+RENAME\s+TO\s+["'`]?(\w+)["'`]?/i)
      if (rebuilt?.[2]?.toLowerCase() === target) {
        const temp = sqlStatementsOf(content).find(s =>
          new RegExp(`^CREATE\\s+TABLE\\s+["'\`]?_qb_tmp_${rebuilt[1]}["'\`]?`, 'i').test(s.trim()),
        )
        if (temp) {
          columns.clear()
          for (const column of columnsDefinedByCreate(temp))
            columns.add(column.toLowerCase())
        }
      }
    }
  }

  return columns
}

/**
 * The ALTERs that bring a historically rooted table up to the model's shape.
 *
 * A rooted table's CREATE lives in preserved history, so regeneration omits
 * the full CREATE it just generated - re-creating the table would sit after
 * authored backfills that already ran against the old shape. That is right
 * for a table whose columns have not changed and SILENTLY WRONG for one that
 * gained some: the new columns were in the omitted CREATE and nowhere else,
 * so no database could ever reach the declared schema, while the snapshot was
 * written as though the whole corpus had been emitted.
 *
 * Observed on a real app: `posts`, `campaigns` and `campaign_sends` were
 * short 20 columns after a full migrate from empty, with the models and the
 * snapshot both insisting they were present.
 *
 * Emitting ADD COLUMN for exactly the gap keeps the root and the backfills in
 * place and still lands the new columns.
 */
export function rootedTableCatchUpStatements(
  createStatement: string,
  existingColumns: ReadonlySet<string>,
): string[] {
  const table = createStatement.match(/^\s*CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["'`]?(\w+)["'`]?/i)?.[1]
  if (!table)
    return []

  const body = createStatement.match(/\(([\s\S]*)\)\s*;?\s*$/)?.[1]
  if (!body)
    return []

  const definitions = new Map<string, string>()
  let depth = 0
  let current = ''
  const parts: string[] = []

  for (const char of body) {
    if (char === '(')
      depth++
    if (char === ')')
      depth--
    if (char === ',' && depth === 0) {
      parts.push(current)
      current = ''
      continue
    }
    current += char
  }
  parts.push(current)

  const constraint = /^\s*(?:PRIMARY\s+KEY|FOREIGN\s+KEY|UNIQUE|CHECK|CONSTRAINT|KEY|INDEX)\b/i
  for (const raw of parts) {
    const part = raw.trim()
    if (!part || constraint.test(part))
      continue
    const name = part.match(/^["'`]?(\w+)["'`]?/)?.[1]
    if (name)
      definitions.set(name.toLowerCase(), part)
  }

  const statements: string[] = []
  for (const [name, definition] of definitions) {
    if (existingColumns.has(name))
      continue

    // SQLite refuses ADD COLUMN for PRIMARY KEY, UNIQUE, and AUTOINCREMENT.
    // A column carrying one of those cannot be added after the fact, so it is
    // left out rather than emitted as SQL that fails mid-run.
    if (/\b(?:PRIMARY\s+KEY|UNIQUE|AUTOINCREMENT)\b/i.test(definition))
      continue

    // NOT NULL with no default is the subtle one: SQLite accepts it against an
    // EMPTY table and rejects it against a populated one ("Cannot add a NOT
    // NULL column with default value NULL"), because the existing rows would
    // have nowhere to get a value. Emitting it as written therefore produces a
    // migration that passes in CI, where every table starts empty, and fails
    // on the production database it was written for.
    //
    // The constraint is dropped rather than the column. A missing column
    // breaks every query that names it; a nullable one works and merely holds
    // a weaker rule than the model asks for, which the model is still the
    // source of truth for - a later regenerate emits the table rebuild that
    // tightens it, once there is a value to backfill with.
    const nullable = /\bNOT\s+NULL\b/i.test(definition) && !/\bDEFAULT\b/i.test(definition)
      ? definition.replace(/\s*\bNOT\s+NULL\b/i, '')
      : definition

    statements.push(`ALTER TABLE "${table}" ADD COLUMN ${nullable.trim()}`)
  }

  return statements
}

/** The tables a set of generated statements creates, lowercased. */
export function createdTablesOf(statements: readonly string[]): string[] {
  const tables = new Set<string>()
  for (const statement of statements) {
    const match = statement.trim().match(/^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["'`]?(\w+)["'`]?/i)
    if (match?.[1])
      tables.add(match[1].toLowerCase())
  }
  return [...tables]
}

/**
 * Tables whose original CREATE migration is preserved history.
 *
 * A pre-marker corpus can contain a hand-authored or legacy generated CREATE
 * followed by newer generated ALTER files and authored data backfills. A full
 * CREATE appended at the end cannot replace that history because the backfill
 * still runs first. Treat the unmarked CREATE as the schema root and retain
 * its generated follow-up migrations in their existing positions.
 */
export function historicallyRootedTables(dir: string, files: readonly string[]): string[] {
  const tables = new Set<string>()

  for (const file of files) {
    if (isGeneratedMigration(dir, file))
      continue

    try {
      for (const statement of sqlStatementsOf(readFileSync(join(dir, file), 'utf8'))) {
        const match = statement.match(/^\s*CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["'`]?(\w+)["'`]?/i)
        if (match?.[1])
          tables.add(match[1].toLowerCase())
      }
    }
    catch {
      // An unreadable file cannot prove a root and is preserved by the normal
      // safety predicate below.
    }
  }

  return [...tables]
}

/**
 * Every table this corpus already defines, however the file was authored.
 *
 * Distinct from {@link historicallyRootedTables}, which deliberately looks only
 * at UNMARKED files to find the roots worth protecting. Here the question is the
 * opposite one: what is the full set of tables a regeneration must reproduce in
 * order to replace this corpus without changing what it describes.
 */
export function tablesDefinedByCorpus(dir: string, files: readonly string[]): string[] {
  const tables = new Set<string>()

  for (const file of files) {
    try {
      for (const statement of sqlStatementsOf(readFileSync(join(dir, file), 'utf8'))) {
        const match = statement.match(/^\s*CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["'`]?(\w+)["'`]?/i)
        if (match?.[1])
          tables.add(match[1].toLowerCase())
      }
    }
    catch {
      // Unreadable here means "cannot prove this table exists"; the file is
      // preserved anyway, because it is never in the rebuilt set.
    }
  }

  return [...tables]
}

/** Whether a migration changes a table whose original CREATE is preserved. */
export function migrationTouchesRootedTable(dir: string, file: string, rootedTables: ReadonlySet<string>): boolean {
  try {
    return tablesOperatedOn(readFileSync(join(dir, file), 'utf8'))
      .some(table => rootedTables.has(table.toLowerCase()))
  }
  catch {
    return false
  }
}

/** Allocate monotonically increasing ordinals without displacing preserved history. */
export function allocateMigrationOrdinals(count: number, startAt: number, reserved: ReadonlySet<number>): number[] {
  const ordinals: number[] = []
  let cursor = startAt

  while (ordinals.length < count) {
    if (!reserved.has(cursor))
      ordinals.push(cursor)
    cursor += 1
  }

  return ordinals
}

/**
 * Which existing migrations describe tables the incoming corpus does NOT
 * rebuild.
 *
 * This is the predicate `regenerateMigrationCorpus` needs and, until
 * stacksjs/stacks#2255, did not have. #2234 established the rule — never
 * delete a migration this run cannot recreate — and implemented it as "does
 * the file carry the `@generated` marker". That was a sound proxy while the
 * generator's model scope was fixed. Once #2220 made framework defaults a
 * fallback rather than a merge, it stopped being one: in an app with its own
 * `app/Models`, the migrations for `users`, `jobs`, `failed_jobs`, `payments`,
 * `subscribers` and `teams` all carry the marker and are all outside the
 * scope of any rerun. Regenerating deleted them, and the result looked clean —
 * one tidy file per model — right up until the next deploy dropped the users
 * table.
 *
 * So ask the question directly instead of by proxy: does the corpus about to
 * be written contain every table this file touches? A file is recreatable only
 * if it does. Anything else is preserved, whoever wrote it.
 *
 * A file whose SQL names no table at all (a bare `SELECT 1;` stub, a
 * `CREATE TYPE`) is preserved too — the same "cannot prove it is ours" bias
 * `isGeneratedMigration` takes, for the same reason.
 */
export function migrationsOutsideCorpus(
  dir: string,
  files: readonly string[],
  corpusTables: readonly string[],
): string[] {
  const rebuilt = new Set(corpusTables.map(table => table.toLowerCase()))

  return files.filter((file) => {
    let contents: string
    try {
      contents = readFileSync(join(dir, file), 'utf8')
    }
    catch {
      return true
    }

    const touched = tablesOperatedOn(contents)
    if (touched.length === 0)
      return true

    return touched.some(table => !rebuilt.has(table))
  })
}

/** The leading ordinal in a migration filename, or 0 when it has none. */
function migrationOrdinal(file: string): number {
  const match = file.match(/^(\d+)/)
  return match ? Number(match[1]) : 0
}

export interface RegeneratedCorpus {
  dialect: string
  /** How many model definitions fed the generation. */
  models: number
  /**
   * The model roots that actually contributed, absolute.
   *
   * Reported because the plan used to claim it had read "app/Models and the
   * framework defaults" unconditionally, which since #2220 is false whenever an
   * app has models of its own — and the count sitting next to that sentence was
   * the only hint that the defaults had contributed nothing
   * (stacksjs/stacks#2255).
   */
  modelRoots: string[]
  /** Files that would be (or were) written, in order. */
  files: Array<{ name: string, statements: number }>
  /** Existing .sql files that would be (or were) removed. */
  removed: string[]
  /**
   * Existing .sql files kept because nothing here can recreate them — for
   * either reason: they carry no `@generated` marker (hand-authored, or
   * emitted before the marker existed), or they describe a table outside this
   * corpus. Callers should show these to the user; a corpus written before the
   * marker shipped will list every file here.
   */
  preserved: string[]
  /**
   * Tables the corpus defines that no model describes, so `onlyExistingTables`
   * could not re-emit them and left their files alone.
   *
   * Named rather than silently skipped: their migrations stay in the previous
   * dialect, which is exactly the condition the caller was trying to clear, and
   * a corpus that is 90% converted looks converted.
   *
   * Always present, empty for every other mode. `Result` is invariant through
   * `mapErr`, so an optional field here would not match the returned object.
   */
  unrebuildable: string[]
  /**
   * The subset of {@link preserved} kept for the second reason: the corpus
   * does not rebuild the tables these files describe.
   *
   * Worth separating in the UI, because the two mean opposite things. An
   * unmarked file is someone's work the generator must not touch; an
   * out-of-scope file is the framework's own schema going unregenerated, and
   * that usually means the model that owned it is no longer in scope
   * (stacksjs/stacks#2255).
   */
  preservedOutOfScope: string[]
  /** The directory operated on. */
  dir: string
}

/**
 * Rebuild the whole migration corpus for one dialect, from the models.
 *
 * This is the fix for a corpus that cannot run on the configured database.
 * Translating the committed SQLite DDL was never viable: the emission threw
 * away varchar lengths, numeric scale and every foreign key (40 of them are
 * `SELECT 1;` stubs). All of that still exists in the model definitions, so
 * regenerating recovers the intent instead of guessing at it.
 *
 * Unlike `persistGeneratedMigrations`, which appends a diff on top of what is
 * already committed, this produces a COMPLETE corpus numbered from 1 and
 * replaces what is there. Callers are responsible for confirming that with the
 * user, and for refusing when the target database already has migrations
 * recorded against the old filenames.
 *
 * It replaces only files it can recreate — those carrying
 * {@link GENERATED_MIGRATION_MARKER}. Anything else is returned in
 * `preserved` and left on disk. That rule is not advisory: a hand-authored
 * migration has no model behind it, so a rerun can never re-emit it, and
 * deleting one is unrecoverable. Callers wanting the old indiscriminate sweep
 * pass `replaceUnmarked`.
 */
export async function regenerateMigrationCorpus(options: {
  dialect?: string
  dir?: string
  dryRun?: boolean
  /**
   * Also delete files carrying no `@generated` marker.
   *
   * For a corpus written before the marker existed and known to be entirely
   * generator output — otherwise the first run after upgrading preserves
   * everything and writes the new corpus alongside it. Never the default: it
   * is the behaviour that lost hand-authored migrations.
   */
  replaceUnmarked?: boolean
  /**
   * Rebuild exactly the tables the corpus already defines, and nothing else.
   *
   * For changing DIALECT rather than schema. Neither existing route can do it
   * (stacksjs/stacks#2346): the default preserves unmarked files, so
   * wrong-dialect CREATEs survive, and `replaceUnmarked` deletes them but the
   * generator only emits tables whose models the app declares, so a framework
   * table the app relies on without declaring is left behind in the old dialect.
   * Turning on `includeFrameworkDefaults` fixes the dialect by writing the
   * framework's entire schema into the app: measured at 80 files from 78 models
   * for an app that declares five.
   *
   * This is the intersection those two miss. Every model is available to the
   * generator, so any table in the corpus can be emitted correctly, but only the
   * tables already present are written. No new tables, none dropped.
   *
   * A table no model describes cannot be regenerated, so its file is preserved
   * and named in `preserved`. Deleting it would drop a schema nothing can
   * rebuild.
   */
  onlyExistingTables?: boolean
} = {}): Promise<Result<RegeneratedCorpus, Error>> {
  try {
    const dialect = options.dialect ?? getQbDialect()
    let requestedVitessSharded: boolean | undefined
    if (dialect === 'vitess') {
      try {
        const { config, overridesReady } = await import('@stacksjs/config')
        await overridesReady
        requestedVitessSharded = isVitessSharded((config as any)?.database?.connections?.vitess?.sharded)
      }
      catch {
        requestedVitessSharded = isVitessSharded(dbConfig.connections.vitess.sharded)
      }
    }
    // The caller may regenerate a corpus other than DB_CONNECTION. Configure
    // the generator for that requested target before it selects the DDL
    // driver; otherwise `migrate:regenerate vitess` inherits SQLite's defaults
    // and silently emits the sharded Vitess profile.
    configureQueryBuilder(
      dialect as 'sqlite' | 'mysql' | 'singlestore' | 'vitess' | 'postgres',
      requestedVitessSharded,
    )
    const dir = options.dir ?? migrationDirectory(dialect)

    // `forceStage` because of the sentinel written just below: it goes into
    // `sources.dir`, and that has to be a directory this call owns rather than
    // the app's own `app/Models` (stacksjs/stacks#2255).
    // `onlyExistingTables` needs every model in scope so a framework table the
    // app relies on without declaring can still be emitted. The output is
    // narrowed to the corpus afterwards, so this widens what CAN be generated
    // without widening what gets written.
    const sources = resolveModelSources({
      forceStage: true,
      ...(options.onlyExistingTables ? { includeFrameworkDefaults: true } : {}),
    })
    if (!sources) {
      return err(new Error(
        'No models found. Define models in app/Models, or ensure the framework defaults at '
        + 'storage/framework/defaults/app/Models are present.',
      ))
    }

    // Force a FULL emit rather than a diff.
    //
    // With no `.qb` snapshot, the generator falls back to introspecting the
    // LIVE database and emitting the delta against it. That is right for
    // `generate:migrations` and wrong here: regenerating the corpus must
    // describe the whole schema, not "whatever this particular database is
    // currently missing". It also matters for correctness, because the
    // generator's ALTER COLUMN path names enum types `<column>_type` while its
    // CREATE TABLE path names them `<table>_<column>_type`, so a delta against
    // a half-built database produced SQL referencing a type nothing creates.
    //
    // bun-query-builder reads `.qb-migrations.<dialect>.json` from the models
    // directory as a starting state, so an empty plan there means "assume
    // nothing exists". Writing it is only safe because of the `forceStage`
    // above: the staging directory is ours and is rebuilt on every call, so
    // this cannot leak into the user's project. Drop that flag and the sentinel
    // lands in `app/Models` (stacksjs/stacks#2255).
    try {
      writeFileSync(
        join(sources.dir, `.qb-migrations.${dialect}.json`),
        JSON.stringify({ plan: { dialect, tables: [] } }),
      )
    }
    catch { /* fall back to the generator's own previous-state resolution */ }

    // A model snapshot outranks the sentinel above, so move it aside for the
    // duration or a full regeneration silently degrades back into a delta.
    // Resolve it the same way every other reader here does — parking a
    // hardcoded `.qb` path would find nothing and quietly degrade to a delta
    // now that the generator honours `snapshotDir` (bun-query-builder 0.1.63).
    const snapshotPath = join(resolveSnapshotDir(), `model-snapshot.${dialect}.json`)
    const parkedSnapshot = `${snapshotPath}.regenerating`
    let snapshotParked = false
    if (existsSync(snapshotPath)) {
      try {
        renameSync(snapshotPath, parkedSnapshot)
        snapshotParked = true
      }
      catch { /* leave it; the sentinel still helps in the common case */ }
    }

    let result: Awaited<ReturnType<typeof qbGenerateMigration>>
    try {
      result = await qbGenerateMigration(sources.dir, {
        dialect: dialect as 'sqlite' | 'mysql' | 'singlestore' | 'vitess' | 'postgres',
        vitessSharded: requestedVitessSharded,
        dryRun: true,
        full: true,
      })
    }
    finally {
      if (snapshotParked) {
        try { renameSync(parkedSnapshot, snapshotPath) }
        catch { /* the snapshot is a cache; regenerating it is cheap */ }
      }
    }

    const statements = result.sqlStatements ?? []
    if (statements.length === 0)
      return err(new Error(`The generator produced no SQL for dialect "${dialect}".`))

    // Never write a corpus we already know will fail. bun-query-builder names
    // an enum type `<table>_<column>_type` when it creates the table, but its
    // ALTER COLUMN path emits the unqualified `<column>_type`, so a generated
    // corpus can reference a type nothing ever creates (observed:
    // `ALTER TABLE "notifications" ALTER COLUMN "type" TYPE "type_type"`,
    // which fails with `type "type_type" does not exist`). Catch it here rather
    // than discovering it 66 files into a migration run.
    const dangling = findDanglingTypeReferences(statements)
    if (dangling.length > 0) {
      return err(new Error(
        `The generator emitted ${dangling.length} reference(s) to enum type(s) it never creates: `
        + `${dangling.slice(0, 5).join(', ')}${dangling.length > 5 ? `, +${dangling.length - 5} more` : ''}. `
        + 'Writing this corpus would fail partway through a migration. This is a bug in the '
        + 'migration generator, not in your models.',
      ))
    }

    let groups = groupGeneratedStatements(statements)

    let existing: string[] = []
    try {
      existing = readdirSync(dir).filter(f => f.endsWith('.sql')).sort()
    }
    catch { /* directory does not exist yet */ }

    // Narrow a dialect-only regeneration to the tables already described.
    //
    // Done before the preservation rules below so everything downstream sees the
    // reduced corpus: `createdTablesOf` then reports exactly the corpus tables,
    // so nothing is out of scope and nothing is deleted for describing a table
    // the emit does not cover.
    let unrebuildable: string[] = []
    if (options.onlyExistingTables) {
      const corpusTables = new Set(tablesDefinedByCorpus(dir, existing))
      if (corpusTables.size === 0) {
        return err(new Error(
          `No CREATE TABLE statements found in ${dir}, so there is nothing to regenerate in place. `
          + 'Run `buddy migrate:regenerate <dialect>` without --only-existing-tables to write a corpus from your models.',
        ))
      }

      const emitted = new Set(createdTablesOf(statements).map(table => table.toLowerCase()))
      unrebuildable = [...corpusTables].filter(table => !emitted.has(table)).sort()

      groups = groups
        .map(group => ({
          ...group,
          statements: group.statements.filter((statement) => {
            const table = statementTable(statement)
            return table ? corpusTables.has(table.toLowerCase()) : false
          }),
        }))
        .filter(group => group.statements.length > 0)

      if (groups.length === 0) {
        return err(new Error(
          `None of the ${corpusTables.size} table(s) in ${dir} have a model behind them, so none can be regenerated. `
          + 'Declare the models, or publish the framework ones with `buddy publish model <Name>`.',
        ))
      }
    }

    // Two independent reasons to keep a file, and a file only gets deleted if
    // neither applies.
    //
    // 1. It carries no `@generated` marker, so a person wrote it and no rerun
    //    can bring it back (stacksjs/stacks#2234). `--replace-unmarked` waives
    //    this for a corpus that predates the marker.
    // 2. It describes a table this corpus does not rebuild
    //    (stacksjs/stacks#2255). No flag waives this one: `--replace-unmarked`
    //    means "these unmarked files are generator output", not "delete the
    //    schema for tables you are not regenerating".
    // `onlyExistingTables` is a dialect change, so the roots are precisely what
    // has to be replaced: preserving them is what leaves wrong-dialect CREATEs
    // on disk. It is safe here in a way `replaceUnmarked` is not, because every
    // table being deleted is one this run has just re-emitted.
    const rootedTables = new Set(
      options.replaceUnmarked || options.onlyExistingTables ? [] : historicallyRootedTables(dir, existing),
    )
    const outOfScope = new Set(migrationsOutsideCorpus(dir, existing, createdTablesOf(statements)))
    const deletable = options.replaceUnmarked || options.onlyExistingTables
      ? existing
      : existing.filter(file => isGeneratedMigration(dir, file))
    const removed = deletable.filter(file => {
      return !outOfScope.has(file) && !migrationTouchesRootedTable(dir, file, rootedTables)
    })
    const preserved = existing.filter(file => !removed.includes(file))
    const preservedOutOfScope = preserved.filter(file => outOfScope.has(file))

    // A full emit for a historically rooted table would be numbered after the
    // preserved history, so any authored backfill between the old CREATE and
    // the replacement would run against the old shape. Keep the existing
    // generated ALTER chain and omit the late duplicate CREATE/index/alter
    // statements for that table. New tables still receive a full definition.
    //
    // Omitting them wholesale is what lost columns: a rooted table that GAINED
    // attributes had them only in the CREATE being dropped, so no database
    // could reach the declared schema and the snapshot was still written as if
    // it could. The gap is emitted as ADD COLUMN instead, which leaves the root
    // and the backfills exactly where they are.
    const catchUp: string[] = []
    for (const table of rootedTables) {
      const create = groups
        .flatMap(group => group.statements)
        .find(statement => statementTable(statement) === table && /^\s*CREATE\s+TABLE\b/i.test(statement))
      if (!create)
        continue

      const produced = columnsProducedByMigrations(dir, preserved, table)
      if (produced.size === 0)
        continue

      catchUp.push(...rootedTableCatchUpStatements(create, produced))
    }

    const writableGroups = groups
      .map(group => ({
        ...group,
        statements: group.statements.filter((statement) => {
          const table = statementTable(statement)
          return !table || !rootedTables.has(table)
        }),
      }))
      .filter(group => group.statements.length > 0)
      .concat(catchUp.length > 0 ? [{ label: 'alter-rooted-tables-columns', statements: catchUp }] : [])

    // In a fully generated corpus, numbering continues past whatever is kept.
    // In a mixed historical corpus, new full CREATEs must sit immediately after
    // the last unmarked migration, before preserved generated follow-up files
    // such as SQLite table rebuilds. Skip their occupied ordinals instead of
    // renumbering them, since authored backfills may depend on those filenames'
    // relative position.
    const historicalBoundary = existing
      .filter(file => !isGeneratedMigration(dir, file))
      .reduce((max, file) => Math.max(max, migrationOrdinal(file)), 0)
    const startAt = rootedTables.size > 0
      ? historicalBoundary + 1
      : preserved.reduce((max, file) => Math.max(max, migrationOrdinal(file)), 0) + 1
    const reservedOrdinals = new Set(preserved.map(migrationOrdinal))
    const ordinals = allocateMigrationOrdinals(writableGroups.length, startAt, reservedOrdinals)

    const files = writableGroups.map((group, index) => ({
      name: `${String(ordinals[index]!).padStart(10, '0')}-${group.label}.sql`,
      statements: group.statements.length,
    }))

    if (options.dryRun)
      return ok({ dialect, models: sources.models.length, modelRoots: sources.roots, files, removed, preserved, preservedOutOfScope, unrebuildable, dir })

    mkdirSync(dir, { recursive: true })

    // Remove first so a rename (create-x-table -> create-x_items-table) cannot
    // leave an orphan behind that would still be executed.
    for (const file of removed)
      unlinkSync(join(dir, file))

    writableGroups.forEach((group, index) => {
      const body = `${group.statements.map(s => s.trim().replace(/;\s*$/, '')).join(';\n')};\n`
      writeFileSync(join(dir, files[index]!.name), `${GENERATED_MIGRATION_MARKER}\n${body}`)
    })

    // The regenerated SQL and its model snapshot are one source-of-truth
    // update. Persist the snapshot only after every migration file succeeds,
    // matching the ordinary generation path and keeping dialect-specific
    // follow-up generation at a true zero diff.
    saveMigrationSnapshot(result.plan, { dialect: dialect as MigrationPlan['dialect'] })

    return ok({ dialect, models: sources.models.length, modelRoots: sources.roots, files, removed, preserved, preservedOutOfScope, unrebuildable, dir })
  }
  catch (error) {
    return err(handleError('Migration regeneration failed', error))
  }
}

function persistGeneratedMigrations(sqlStatements: string[]): number {
  if (!sqlStatements?.length)
    return 0

  const migrationsDir = migrationDirectory()
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
    // Stamped for the same reason regeneration stamps: this file came from the
    // models, so a later `migrate:regenerate` may replace it. Without the
    // marker it would be preserved as if hand-authored and end up duplicated
    // alongside the regenerated corpus (stacksjs/stacks#2234). The dedup above
    // compares normalized SQL statements, so a leading comment cannot match one.
    writeFileSync(filePath, `${GENERATED_MIGRATION_MARKER}\n${body}`)
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

interface GeneratedCreateStatement {
  statement: string
  table: string
}

interface GeneratedConstraintStatement {
  body: string
  references: string[]
  statement: string
  table: string
}

/**
 * bun-query-builder emits foreign keys as `ALTER TABLE ... ADD CONSTRAINT`
 * statements after its CREATE statements. For a brand-new model that used to
 * become a second `alter-*.sql` migration even though the relationship was
 * present when the table was first defined.
 *
 * Fold acyclic constraints into the owning CREATE TABLE and dependency-sort
 * those creates so referenced tables exist first. Cyclic relationships cannot
 * be declared inline before both tables exist, so retain only those constraints
 * as a final create-time constraint group.
 */
function normalizeCreateStatements(sqlStatements: string[]): string[] {
  const creates: GeneratedCreateStatement[] = []
  const constraints: GeneratedConstraintStatement[] = []
  const passthrough: string[] = []

  for (const raw of sqlStatements) {
    const statement = raw.trim()
    if (!statement)
      continue

    const create = statement.match(/^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?(\w+)["`]?/i)
    if (create?.[1]) {
      creates.push({ statement, table: create[1] })
      continue
    }

    const constraint = statement.match(/^ALTER\s+TABLE\s+["`]?(\w+)["`]?\s+ADD\s+CONSTRAINT\s+([\s\S]+?);?$/i)
    if (constraint?.[1] && constraint[2]) {
      const references = [...constraint[2].matchAll(/REFERENCES\s+["`]?(\w+)["`]?/gi)]
        .flatMap(match => match[1] ? [match[1]] : [])
      constraints.push({ body: `CONSTRAINT ${constraint[2].replace(/;\s*$/, '')}`, references, statement, table: constraint[1] })
      continue
    }

    passthrough.push(statement)
  }

  if (creates.length === 0)
    return sqlStatements.map(statement => statement.trim()).filter(Boolean)

  const createdTables = new Set(creates.map(create => create.table))
  const createOrder = new Map(creates.map((create, index) => [create.table, index]))
  const relevantConstraints = constraints.filter(constraint => createdTables.has(constraint.table))
  const unrelatedConstraints = constraints.filter(constraint => !createdTables.has(constraint.table))
  const dependencies = new Map(creates.map(create => [
    create.table,
    new Set(relevantConstraints
      .filter(constraint => constraint.table === create.table)
      .flatMap(constraint => constraint.references)
      .filter(reference => reference !== create.table && createdTables.has(reference))),
  ]))

  const sortTables = (ignoredEdges = new Set<string>()): string[] => {
    const remaining = new Set(createdTables)
    const sorted: string[] = []
    while (remaining.size > 0) {
      const ready = [...remaining]
        .filter(table => [...(dependencies.get(table) ?? [])].every((dependency) => {
          return !remaining.has(dependency) || ignoredEdges.has(`${table}->${dependency}`)
        }))
        .sort((a, b) => (createOrder.get(a) ?? 0) - (createOrder.get(b) ?? 0))
      if (ready.length === 0)
        break
      for (const table of ready) {
        remaining.delete(table)
        sorted.push(table)
      }
    }
    return sorted
  }

  const initiallySorted = sortTables()
  const cyclicTables = new Set([...createdTables].filter(table => !initiallySorted.includes(table)))
  const deferred = relevantConstraints.filter(constraint => constraint.references.some((reference) => {
    return reference !== constraint.table && cyclicTables.has(constraint.table) && cyclicTables.has(reference)
  }))
  const deferredStatements = new Set(deferred.map(constraint => constraint.statement))
  const ignoredEdges = new Set(deferred.flatMap(constraint => constraint.references.map(reference => `${constraint.table}->${reference}`)))
  const orderedTables = sortTables(ignoredEdges)
  const byTable = new Map(creates.map(create => [create.table, create]))

  const normalizedCreates = orderedTables.map((table) => {
    const create = byTable.get(table)!
    const inline = relevantConstraints.filter(constraint => constraint.table === table && !deferredStatements.has(constraint.statement))
    if (inline.length === 0)
      return create.statement

    const closing = create.statement.lastIndexOf(')')
    if (closing < 0)
      return create.statement
    const before = create.statement.slice(0, closing).trimEnd()
    const after = create.statement.slice(closing)
    return `${before},\n  ${inline.map(constraint => constraint.body).join(',\n  ')}\n${after}`
  })

  return [
    ...normalizedCreates,
    ...passthrough,
    ...unrelatedConstraints.map(constraint => constraint.statement),
    ...deferred.map(constraint => constraint.statement),
  ]
}

/**
 * Group generated SQL by the migration filename style the runner already
 * uses for hand-written files: `create-<table>-table`,
 * `alter-<table>-<col>`, `create-<index>-index-in-<table>`, or
 * `drop-<table>-table`. Anything we can't match falls back to `auto-misc`.
 */
export function groupGeneratedStatements(sqlStatements: string[]): GeneratedGroup[] {
  const normalizedStatements = normalizeCreateStatements(sqlStatements)
  const groups = new Map<string, string[]>()
  const push = (label: string, stmt: string): void => {
    const list = groups.get(label) ?? []
    list.push(stmt)
    groups.set(label, list)
  }

  const createdTables = new Set(normalizedStatements.flatMap((raw) => {
    const match = raw.trim().match(/^\s*CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?(\w+)["`]?/i)
    return match?.[1] ? [match[1]] : []
  }))

  for (const raw of normalizedStatements) {
    const stmt = raw.trim()
    if (!stmt) continue

    const create = stmt.match(/^\s*CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?(\w+)["`]?/i)
    if (create) { push(`create-${create[1]}-table`, stmt); continue }

    // PostgreSQL enum types must exist before any CREATE TABLE that names
    // them. Keep all generated types in a dedicated prerequisite migration;
    // the priority sort below guarantees it receives the first migration
    // number even though bun-query-builder emits type statements last.
    const createType = stmt.match(/^\s*CREATE\s+TYPE\s+/i)
    if (createType) { push('create-database-types', stmt); continue }

    const alter = stmt.match(/^\s*ALTER\s+TABLE\s+["`]?(\w+)["`]?\s+(?:ADD\s+COLUMN\s+["`]?(\w+)["`]?|DROP\s+COLUMN\s+["`]?(\w+)["`]?|ADD\s+CONSTRAINT)/i)
    const alterTable = alter?.[1]
    if (alter && alterTable) {
      // One migration per TABLE, not per column. Ten new attributes on a model
      // is one edit and one schema change; it used to become ten numbered
      // migrations that only ever ran together. Grouping by table also makes
      // each file one transaction-sized unit, so a half-applied change is a
      // file that failed rather than a run that stopped in the middle of a set.
      //
      // `-columns`, not `-table`, on purpose: bun-query-builder's runner
      // treats a file matching `alter-*-table` as its own throwaway output —
      // replayed rather than recorded, then deleted from disk. Naming these
      // `alter-fields-table.sql` handed every generated migration to that
      // path and they vanished after their first run. The per-column names
      // this replaces never matched the pattern, so this keeps that property
      // while collapsing the files.
      const isCreateTimeConstraint = createdTables.has(alterTable) && !alter[2] && !alter[3]
      push(isCreateTimeConstraint ? 'create-foreign-key-constraints' : `alter-${alterTable}-columns`, stmt)
      continue
    }

    const idx = stmt.match(/^\s*CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?(\w+)["`]?\s+ON\s+["`]?(\w+)["`]?/i)
    const idxName = idx?.[1]
    const idxTable = idx?.[2]
    if (idxName && idxTable) {
      push(createdTables.has(idxTable) ? `create-${idxTable}-table` : `create-${idxName}-index-in-${idxTable}`, stmt)
      continue
    }

    const drop = stmt.match(/^\s*DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?["`]?(\w+)["`]?/i)
    if (drop) { push(`drop-${drop[1]}-table`, stmt); continue }

    push('auto-misc', stmt)
  }

  return [...groups.entries()]
    .map(([label, statements]) => ({ label, statements }))
    .sort((a, b) => Number(b.label === 'create-database-types') - Number(a.label === 'create-database-types'))
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

    // dryRun: true — see the comment on the equivalent call in
    // generateMigrations() above; bun-query-builder's own file writer
    // doesn't know about already-committed migration numbering.
    const qbDialect = getQbDialect()
    await qbGenerateMigration(modelsDir, {
      dialect: qbDialect,
      vitessSharded: qbDialect === 'vitess' ? isVitessSharded(dbConfig.connections.vitess.sharded) : undefined,
      full: true,
      dryRun: true,
    })

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
