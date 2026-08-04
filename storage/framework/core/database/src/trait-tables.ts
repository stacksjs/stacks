/**
 * Polymorphic Trait Tables Migration
 *
 * Ships the tables the polymorphic model traits query but that nothing ever
 * created in a consumer app:
 *
 * - `commentables`        (`commentable` trait + the CMS commentables module)
 * - `taggables`           (`taggable` trait + the CMS taggables module)
 * - `categorizables`      (`categorizable` trait + the CMS categorizables module)
 * - `commentable_upvotes` (comment upvotes)
 *
 * None of these has a model, so bun-query-builder — which derives every
 * migration from `app/Models` — never generated them. The driver-specific
 * `generate{Mysql,Postgres}TraitMigrations()` helpers that were meant to cover
 * the gap had no caller anywhere in the codebase, had no sqlite equivalent at
 * all, and emitted `.ts` migration files that the runner cannot execute (it
 * only ever reads `.sql`). The net effect was that setting `commentable: true`
 * on a model silently did nothing and any trait call hit a missing table.
 *
 * Mirrors `rbac-tables.ts` / `notification-tables.ts`: pure cross-dialect DDL
 * builders (so the SQL is unit-testable without a server) plus a thin
 * `migrateTraitTables()` executor wired into `buddy migrate`. Every statement
 * is `IF NOT EXISTS`, so it is safe to run on every migrate and a model that
 * legitimately owns one of these table names stays authoritative.
 *
 * Schemas match the interfaces in
 * `storage/framework/core/orm/src/generated/table-traits.ts` and the columns
 * the CMS modules read and write.
 *
 * ## Why `created_at` / `updated_at` are VARCHAR here
 *
 * Unlike `rbac-tables.ts` / `notification-tables.ts`, which declare TIMESTAMP,
 * these columns are VARCHAR(64). Every writer for these tables — the ORM traits
 * and the CMS modules — sends `new Date().toISOString()`, and that literal was
 * exercised against all three engines:
 *
 * - MySQL rejects it outright against a TIMESTAMP column ("Incorrect datetime
 *   value: '2026-08-04T00:59:51.033Z'"), because strict mode does not accept
 *   the ISO-8601 `T`/`Z` form. The table would exist but be unwritable.
 * - Postgres accepts it into a TIMESTAMP but parses it as a naive local
 *   timestamp, so the value round-trips back shifted by the server's UTC
 *   offset.
 * - VARCHAR stores the exact string on all three, and ISO-8601 UTC sorts
 *   correctly lexicographically, so `orderBy('created_at', 'desc')` is
 *   unaffected.
 *
 * This also matches how these columns are typed (`created_at?: string`) and how
 * the committed `0000000120-create-commentables-table.sql` declares them.
 *
 * There is no `DEFAULT CURRENT_TIMESTAMP`: MySQL rejects that default on a
 * VARCHAR column ("Invalid default value"). Every current writer sets the value
 * explicitly, so the default was never what filled these columns.
 *
 * The same ISO-vs-TIMESTAMP mismatch affects the already-shipped `notifications`
 * table, whose driver writes `toISOString()` into a TIMESTAMP column. That is a
 * pre-existing bug in a different subsystem and is not addressed here.
 */

import { log } from '@stacksjs/logging'
import { env as envVars } from '@stacksjs/env'
import { db } from './utils'
import { sqlHelpers } from './sql-helpers'
import { dialectCapabilities } from './dialect'

type SqlHelpers = ReturnType<typeof sqlHelpers>

function getDbDriver(): string {
  return process.env.DB_CONNECTION || envVars.DB_CONNECTION || 'sqlite'
}

/**
 * The timestamp columns on these tables. See the module header for why these
 * are text rather than TIMESTAMP.
 */
const CREATED_AT = 'created_at VARCHAR(64)'
const UPDATED_AT = 'updated_at VARCHAR(64)'

/**
 * The tables {@link migrateTraitTables} owns.
 *
 * The single source of truth for this set: the reset paths in
 * `drivers/defaults/traits.ts` drop exactly these, so a table added here is
 * dropped by `migrate:fresh` without a second list to remember.
 */
export function traitTableNames(): string[] {
  return [
    'commentables',
    'taggables',
    'categorizables',
    'commentable_upvotes',
    'taggable_models',
    'categorizable_models',
  ]
}

/**
 * The `taggable_id` / `categorizable_id` value that marks a catalogue row —
 * a tag or category that belongs to an owning model *type* but to no
 * individual record.
 *
 * A sentinel rather than NULL because the uniqueness rule has to hold on all
 * three engines: SQLite and MySQL treat NULLs as distinct in a UNIQUE index
 * (so two catalogue rows with the same slug would both be accepted), and
 * `NULLS NOT DISTINCT` is Postgres 15+ only. A concrete value makes
 * `UNIQUE (type, owner_id, slug)` mean the same thing everywhere.
 */
export const UNSCOPED_OWNER_ID = 0

/**
 * `commentables` — comments attached polymorphically to an owning model.
 * `commentables_id` + `commentables_type` identify the owner (e.g. 123 /
 * 'posts'). Columns match `CommentablesTable` and the writes in
 * `cms/src/commentables/store.ts` and `orm/src/traits/commentable.ts`.
 *
 * `approved_at` / `rejected_at` hold epoch milliseconds, which overflows a
 * 32-bit INTEGER on Postgres and MySQL — hence BIGINT. SQLite gives every
 * INTEGER 64 bits, so the same declaration is correct there too.
 *
 * This is a distinct table from `comments`: `comments` is a model-backed
 * table, `commentables` is the polymorphic trait table.
 */
export function commentablesTableSql(sql: SqlHelpers): string {
  const { pkColumn, boolTrue } = sql
  return `CREATE TABLE IF NOT EXISTS commentables (
    ${pkColumn},
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    approved_at BIGINT,
    rejected_at BIGINT,
    commentables_id INTEGER NOT NULL,
    commentables_type VARCHAR(255) NOT NULL,
    user_id INTEGER,
    is_active BOOLEAN NOT NULL DEFAULT ${boolTrue},
    ${CREATED_AT},
    ${UPDATED_AT}
  )`
}

/**
 * `taggables` — the tag catalogue, scoped to an owning model type.
 *
 * `taggable_id` is nullable because the two consumers disagree about it: the
 * CMS module treats a row as a type-scoped tag with no single owner, while
 * `orm/src/traits/taggable.ts` writes one row per owner and filters on
 * `taggable_id`. That disagreement predates this file and is not resolved
 * here — the schema is the union both can read, matching the committed
 * `0000000118-create-taggables-table.sql`.
 */
export function taggablesTableSql(sql: SqlHelpers): string {
  const { pkColumn, boolTrue } = sql
  return `CREATE TABLE IF NOT EXISTS taggables (
    ${pkColumn},
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT ${boolTrue},
    taggable_id INTEGER NOT NULL DEFAULT ${UNSCOPED_OWNER_ID},
    taggable_type VARCHAR(255) NOT NULL,
    ${CREATED_AT},
    ${UPDATED_AT}
  )`
}

/**
 * `categorizables` — the category catalogue, scoped to an owning model type.
 * The owner link lives in the model-declared `categorizable_models` pivot,
 * which `orm/src/traits/categorizable.ts` reads to resolve category ids.
 */
export function categorizablesTableSql(sql: SqlHelpers): string {
  const { pkColumn, boolTrue } = sql
  return `CREATE TABLE IF NOT EXISTS categorizables (
    ${pkColumn},
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT ${boolTrue},
    categorizable_id INTEGER NOT NULL DEFAULT ${UNSCOPED_OWNER_ID},
    categorizable_type VARCHAR(255) NOT NULL,
    ${CREATED_AT},
    ${UPDATED_AT}
  )`
}

/**
 * `taggable_models` — links an owning record to a row in the tag catalogue.
 *
 * Guaranteed here because the trait needs it whenever a model sets
 * `taggable: true`. It otherwise only exists when a model *separately*
 * declares a matching `belongsToMany` pivot (as the framework's Post model
 * does), which left `taggable: true` on its own pointing at a missing table.
 */
export function taggableModelsTableSql(sql: SqlHelpers): string {
  const { pkColumn } = sql
  return `CREATE TABLE IF NOT EXISTS taggable_models (
    ${pkColumn},
    tag_id INTEGER NOT NULL,
    taggable_id INTEGER NOT NULL,
    taggable_type VARCHAR(255) NOT NULL,
    ${CREATED_AT},
    ${UPDATED_AT}
  )`
}

/**
 * `categorizable_models` — the categorizable counterpart to
 * {@link taggableModelsTableSql}. `orm/src/traits/categorizable.ts` reads this
 * table directly to resolve the category ids an owner is filed under.
 */
export function categorizableModelsTableSql(sql: SqlHelpers): string {
  const { pkColumn } = sql
  return `CREATE TABLE IF NOT EXISTS categorizable_models (
    ${pkColumn},
    category_id INTEGER NOT NULL,
    categorizable_id INTEGER NOT NULL,
    categorizable_type VARCHAR(255) NOT NULL,
    ${CREATED_AT},
    ${UPDATED_AT}
  )`
}

/**
 * `<table>_likes` — the per-model table the `likeable` trait reads and writes.
 *
 * Unlike every other trait table this one has no fixed name: the trait derives
 * it from the owning model (`posts` → `posts_likes`), or from
 * `likeable: { table, foreignKey }`. Nothing created it on any driver, so
 * `likeable: true` failed with "no such table" exactly the way the
 * polymorphic traits did.
 *
 * `UNIQUE (foreignKey, user_id)` is the constraint `like()` already depends on:
 * it catches the duplicate and returns the existing row instead of inserting
 * twice.
 */
export function likesTableSql(sql: SqlHelpers, table: string, foreignKey: string): string {
  const { pkColumn } = sql
  return `CREATE TABLE IF NOT EXISTS ${table} (
    ${pkColumn},
    ${foreignKey} INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    ${CREATED_AT},
    ${UPDATED_AT},
    UNIQUE (${foreignKey}, user_id)
  )`
}

/**
 * `commentable_upvotes` — upvotes on a polymorphic target. Columns match
 * `CommentableUpvotesTable`.
 */
export function commentableUpvotesTableSql(sql: SqlHelpers): string {
  const { pkColumn } = sql
  return `CREATE TABLE IF NOT EXISTS commentable_upvotes (
    ${pkColumn},
    user_id INTEGER,
    upvoteable_id INTEGER NOT NULL,
    upvoteable_type VARCHAR(255) NOT NULL,
    ${CREATED_AT}
  )`
}

/**
 * Secondary indexes for the trait tables.
 *
 * The unique indexes are the catalogue contract the CMS `findOrCreate` paths
 * rely on: a tag/category name is unique *within* an owning model type, so
 * 'posts' and 'products' can each have a "news" tag.
 *
 * Kept separate from the CREATE TABLE statements because not every dialect
 * accepts `CREATE INDEX IF NOT EXISTS` — see
 * `DialectCapabilities.supportsCreateIndexIfNotExists`. Where it isn't
 * supported, {@link migrateTraitTables} drops the clause and tolerates the
 * duplicate-index error on replay instead.
 */
export function traitTableIndexSql(): string[] {
  return [
    `CREATE INDEX IF NOT EXISTS commentables_owner_index ON commentables (commentables_type, commentables_id)`,
    `CREATE INDEX IF NOT EXISTS commentables_status_index ON commentables (status)`,
    // Scoped by owner, not just by type. A catalogue row uses
    // UNSCOPED_OWNER_ID, so "one 'news' tag per model type" still holds, while
    // the per-owner rows `orm/src/traits/taggable.ts` writes no longer collide
    // the moment a second record is given the same tag.
    `CREATE UNIQUE INDEX IF NOT EXISTS taggables_owner_slug_unique ON taggables (taggable_type, taggable_id, slug)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS categorizables_owner_slug_unique ON categorizables (categorizable_type, categorizable_id, slug)`,
    `CREATE INDEX IF NOT EXISTS commentable_upvotes_target_index ON commentable_upvotes (upvoteable_type, upvoteable_id)`,
    // One upvote per user per target — `upvote()` relies on this to stay
    // idempotent rather than stacking duplicate rows.
    `CREATE UNIQUE INDEX IF NOT EXISTS commentable_upvotes_user_unique ON commentable_upvotes (upvoteable_type, upvoteable_id, user_id)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS taggable_models_unique ON taggable_models (tag_id, taggable_id, taggable_type)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS categorizable_models_unique ON categorizable_models (category_id, categorizable_id, categorizable_type)`,
  ]
}

/**
 * The `<table>_likes` tables to create, one per model that sets `likeable`.
 *
 * Model discovery mirrors the reset paths (`dropSqliteTables`, …): userland
 * models first, then the framework defaults. The orm helpers are imported
 * lazily because this module is a leaf that the drivers barrel imports —
 * pulling `@stacksjs/orm` in at the top level would re-enter that barrel and
 * deadlock bun's module loader (see `drivers/helpers.ts`).
 */
export async function likeableTargets(): Promise<Array<{ table: string, foreignKey: string }>> {
  const { path } = await import('@stacksjs/path')
  const { globSync } = await import('@stacksjs/storage')
  const { getTableName } = await import('@stacksjs/orm')
  const { getLikeableForeignKey, getUpvoteTableName } = await import('./drivers/helpers')

  const modelFiles = globSync(
    [path.userModelsPath('*.ts'), path.storagePath('framework/defaults/app/Models/**/*.ts')],
    { absolute: true },
  )

  const targets = new Map<string, { table: string, foreignKey: string }>()
  for (const modelFile of modelFiles) {
    let model: any
    try {
      model = (await import(modelFile)).default
    }
    catch {
      continue // a model that can't be imported is the generator's problem, not ours
    }
    if (!model?.traits?.likeable)
      continue

    const tableName = await getTableName(model, modelFile)
    if (!tableName)
      continue

    const table = getUpvoteTableName(model, tableName as string)
    if (!table || !/^[a-z_]\w*$/i.test(table))
      continue

    const foreignKey = getLikeableForeignKey(model, tableName as string)
    if (!/^[a-z_]\w*$/i.test(foreignKey))
      continue

    targets.set(table, { table, foreignKey })
  }

  return [...targets.values()]
}

/**
 * Strip `IF NOT EXISTS` for dialects that reject it on `CREATE INDEX`, and let
 * {@link isDuplicateIndexError} absorb the replay there instead.
 */
export function indexSqlForDialect(statement: string, dialect: string): string {
  if (dialectCapabilities(dialect).supportsCreateIndexIfNotExists)
    return statement
  return statement.replace(/^(CREATE (?:UNIQUE )?INDEX) IF NOT EXISTS /i, '$1 ')
}

/** Whether an error is MySQL's "index already exists", i.e. a benign replay. */
function isDuplicateIndexError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /duplicate key name|already exists/i.test(message)
}

/**
 * Create the polymorphic trait tables. Idempotent (`IF NOT EXISTS`), so it's
 * safe to run on every `buddy migrate`.
 *
 * Runs AFTER the model migrations for the same reason the notification and
 * RBAC guarantees do: an app model that legitimately owns one of these table
 * names must stay authoritative, and pre-creating the table would suppress
 * its generated migration.
 */
export async function migrateTraitTables(options: { verbose?: boolean } = {}): Promise<{ success: boolean, error?: string }> {
  const dbDriver = getDbDriver()
  const sql = sqlHelpers(dbDriver)

  if (options.verbose)
    log.info(`Creating polymorphic trait tables for ${dbDriver}...`)

  try {
    if (options.verbose) log.info('Creating commentables table...')
    await db.unsafe(commentablesTableSql(sql)).execute()

    if (options.verbose) log.info('Creating taggables table...')
    await db.unsafe(taggablesTableSql(sql)).execute()

    if (options.verbose) log.info('Creating categorizables table...')
    await db.unsafe(categorizablesTableSql(sql)).execute()

    if (options.verbose) log.info('Creating commentable_upvotes table...')
    await db.unsafe(commentableUpvotesTableSql(sql)).execute()

    if (options.verbose) log.info('Creating taggable_models pivot...')
    await db.unsafe(taggableModelsTableSql(sql)).execute()

    if (options.verbose) log.info('Creating categorizable_models pivot...')
    await db.unsafe(categorizableModelsTableSql(sql)).execute()

    // One `<table>_likes` per model that sets `likeable`. Model discovery can
    // fail in environments without an app (a bare framework test run), which
    // must not take the fixed tables down with it.
    try {
      for (const { table, foreignKey } of await likeableTargets()) {
        if (options.verbose) log.info(`Creating ${table} table...`)
        await db.unsafe(likesTableSql(sql, table, foreignKey)).execute()
      }
    }
    catch (error) {
      log.debug(`[trait-tables] Skipped likeable tables: ${error instanceof Error ? error.message : String(error)}`)
    }

    for (const statement of traitTableIndexSql()) {
      try {
        await db.unsafe(indexSqlForDialect(statement, dbDriver)).execute()
      }
      catch (error) {
        // A pre-existing index is the expected outcome on MySQL replays.
        // Anything else is a real failure and must surface.
        if (!isDuplicateIndexError(error))
          throw error
      }
    }

    if (options.verbose) log.success('Polymorphic trait tables created')
    return { success: true }
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    log.error(`Failed to create polymorphic trait tables: ${message}`)
    return { success: false, error: message }
  }
}
