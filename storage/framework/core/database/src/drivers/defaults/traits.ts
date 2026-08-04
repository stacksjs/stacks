/**
 * Framework-owned tables that no model declares, and the drop helpers the
 * reset paths use.
 *
 * This module used to also hold ~700 lines of per-dialect trait-table
 * *creators* (`createCommentablesTable`, `createTaggableTable`, the
 * `createPostgres*` variants, …). They were only ever called from
 * `generateMysqlTraitMigrations()` / `generatePostgresTraitMigrations()`,
 * which had no caller anywhere in the codebase and no sqlite equivalent, and
 * they emitted `.ts` migration files that the runner cannot execute — it reads
 * only `.sql`. So they created nothing on any driver.
 *
 * Creating those tables now lives in `../../trait-tables.ts`, which runs real
 * DDL against the live connection and is wired into `buddy migrate`. The
 * creators were removed rather than left in place because their presence is
 * what made the missing tables look like a wiring problem.
 *
 * The tables they nominally covered are all accounted for:
 * - `commentables` / `taggables` / `categorizables` / `commentable_upvotes`
 *   → `migrateTraitTables()` in `../../trait-tables.ts`
 * - `passkeys` / `password_resets` → `migrateAuthTables()` in `../../auth-tables.ts`
 * - `tags` / `comments` / `query_logs` → the Tag, Comment and QueryLog models
 * - `taggable_models` / `categorizable_models` → model-declared pivots
 */

import { db } from '../../utils'
import { dialectCapabilities } from '../../dialect'
// Leaf module (utils/sql-helpers/dialect only), so importing it here adds no
// cycle back through the drivers barrel.
import { traitTableNames } from '../../trait-tables'
import { env as envVars } from '@stacksjs/env'

function getDbDriver(): string {
  return process.env.DB_CONNECTION || envVars.DB_CONNECTION || 'sqlite'
}

/**
 * Every framework-owned table a database reset must drop on top of the
 * model-derived ones.
 *
 * Single source of truth on purpose: this list used to be duplicated between
 * `dropCommonTables()` (MySQL + SQLite) and a `dropCommonPostgresTables()` in
 * the Postgres driver, and the two had drifted — the Postgres copy never
 * dropped `categorizable_models`, `categories_models` or `activities`, so
 * `migrate:fresh` on Postgres left them behind with stale rows.
 */
export function commonTableNames(): string[] {
  return [
    // commentables/taggables/categorizables/commentable_upvotes and the two
    // trait pivots. The per-model `<table>_likes` tables are not listed: they
    // have no fixed name, and the reset paths already drop everything
    // `fetchTables()` reports.
    ...traitTableNames(),
    'passkeys',
    'password_resets',
    'query_logs',
    'tags',
    'comments',
    'categories_models',
    'activities',
  ]
}

/**
 * Drop the framework-owned tables. Dialect-aware: Postgres needs `CASCADE` to
 * clear dependent foreign keys, and each dialect quotes identifiers its own
 * way. Every name here is a hard-coded literal, never user input.
 */
export async function dropCommonTables(): Promise<void> {
  const { identifierQuote: q, wire } = dialectCapabilities(getDbDriver())
  const cascade = wire === 'postgres' ? ' CASCADE' : ''

  for (const table of commonTableNames())
    await db.unsafe(`DROP TABLE IF EXISTS ${q}${table}${q}${cascade}`).execute()
}

/** Drop the migration ledger tables, so the next migrate starts from zero. */
export async function dropMigrationTables(): Promise<void> {
  const { identifierQuote: q, wire } = dialectCapabilities(getDbDriver())
  const cascade = wire === 'postgres' ? ' CASCADE' : ''

  for (const table of ['migrations', 'migration_locks'])
    await db.unsafe(`DROP TABLE IF EXISTS ${q}${table}${q}${cascade}`).execute()
}
