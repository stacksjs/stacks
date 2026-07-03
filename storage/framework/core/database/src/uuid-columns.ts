/**
 * UUID Column Guarantee
 *
 * `useUuid: true` is a per-model trait (storage/framework/core/types/src/
 * model.ts), and the ORM's insert path (createFillableAttributes in
 * orm/src/utils.ts) writes a `uuid` value on every `Model.create(...)` call
 * once it's set — but the trait is only read by the *migration codegen*
 * (drivers/sqlite.ts, mysql.ts, postgres.ts's `createTableMigration`) at the
 * moment a table's CREATE TABLE migration is generated. Toggle the trait on
 * an existing model afterward (or inherit a default model that already has
 * it, like `User`, `Team`, or any of the 79 defaults declaring it) and
 * nothing ever regenerates that table's migration — `copyModelFiles`'s
 * change-detection only diffs `model.attributes`, not `model.traits`. The
 * result: 59 of this framework's own 63 committed `create-*-table`
 * migrations lack a `uuid` column despite their models declaring the trait,
 * so `Model.create(...)` throws `no such column: uuid` on a freshly migrated
 * database for the vast majority of `useUuid` models, `User` included.
 *
 * Same shape as the passkeys/two_factor/stripe_id gaps in auth-tables.ts,
 * but not fixable the same way: those are hardcoded ALTERs against the one
 * `users` table, while this trait spans dozens of tables across userland and
 * framework-default models. So instead of enumerating tables by hand, this
 * walks every model file (same directories generate-database-schema.ts's
 * codegen walks), reads `traits.useUuid` off each, and guarantee-ALTERs the
 * resolved table — covering every current model and any future one, with or
 * without a regenerated migration (stacksjs/status#1 Phase 9).
 */

import type { Model } from '@stacksjs/types'
import process from 'node:process'
import { log } from '@stacksjs/logging'
import { path } from '@stacksjs/path'
import { getModelName, getTableName } from '@stacksjs/orm'
import { fs } from '@stacksjs/storage'
import { db } from './utils'
import { sqlHelpers } from './sql-helpers'

type SqlHelpers = ReturnType<typeof sqlHelpers>

function getDbDriver(): string {
  return process.env.DB_CONNECTION || 'sqlite'
}

/**
 * Dialect-specific `uuid` column type — matches what `createTableMigration`
 * already emits per driver for a freshly generated `useUuid` table (sqlite:
 * `text`, mysql: `varchar(255)`, postgres: `uuid`), so a table whose
 * migration already has the column and one guarantee-ALTERed here end up
 * with the same type.
 */
function uuidColumnType(sql: SqlHelpers): string {
  if (sql.isPostgres) return 'UUID'
  if (sql.isMysql) return 'VARCHAR(255)'
  return 'TEXT'
}

/** Pure builder so tests can assert per-dialect DDL without a live DB. */
export function uuidColumnSql(table: string, sql: SqlHelpers): string {
  return `ALTER TABLE ${table} ADD COLUMN uuid ${uuidColumnType(sql)}`
}

/**
 * Walk a models directory (recursively — both userland `app/Models` and
 * framework-default `defaults/app/Models` nest models in subdirectories,
 * e.g. `commerce/`, `Content/`) and load each model's default export.
 * Mirrors generate-database-schema.ts's `loadModelsFrom` — per-file import
 * failures are swallowed since a broken model file elsewhere shouldn't stop
 * this guarantee from covering the rest.
 */
async function loadModelsFrom(dir: string): Promise<Array<{ filePath: string, model: Model }>> {
  const out: Array<{ filePath: string, model: Model }> = []
  if (!fs.existsSync(dir)) return out

  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...(await loadModelsFrom(fullPath)))
      continue
    }
    if (!entry.name.endsWith('.ts')) continue
    if (entry.name.startsWith('_') || entry.name.startsWith('index')) continue

    try {
      const imported = (await import(fullPath)).default as Model
      if (imported?.name || imported?.table)
        out.push({ filePath: fullPath, model: imported })
    }
    catch {
      // Per-file failure is non-fatal — same tolerance as the schema codegen.
    }
  }
  return out
}

/**
 * Resolve every table backing a model with `useUuid: true`, across both
 * userland (`app/Models`) and framework-default (`defaults/app/Models`)
 * model directories. Exported so tests (and `doctor`-style diagnostics) can
 * inspect the resolved set without touching a live database.
 */
export async function findUuidTables(): Promise<string[]> {
  const dirs = [path.userModelsPath(), path.frameworkPath('defaults/app/Models')]
  const tables = new Set<string>()

  for (const dir of dirs) {
    for (const { filePath, model } of await loadModelsFrom(dir)) {
      if (!model.traits?.useUuid) continue
      tables.add(getTableName(model, filePath) as unknown as string)
    }
  }

  return [...tables]
}

/**
 * Guarantee-ALTER `uuid` onto every table whose model declares
 * `useUuid: true`, independently try/catch-swallowed per table so one
 * already-having-the-column (or not-yet-existing) table never skips the
 * rest. Exported so `buddy migrate`/`migrate:fresh` can call it after model
 * migrations run, same pattern as {@link ensureUsersAuthColumns} — see the
 * call sites in buddy/src/commands/migrate.ts.
 */
export async function ensureUuidColumns(sql: SqlHelpers, options: { verbose?: boolean } = {}): Promise<void> {
  const tables = await findUuidTables()

  for (const table of tables) {
    try {
      await db.unsafe(uuidColumnSql(table, sql)).execute()
      if (options.verbose) log.debug(`[uuid-columns] Added uuid column to ${table}`)
    }
    catch {
      // Column already exists (or table missing) — safe to ignore.
      if (options.verbose) log.debug(`[uuid-columns] Skipped (already applied or ${table} missing): uuid column`)
    }
  }
}

/** Convenience wrapper resolving dialect helpers from `DB_CONNECTION`, for call sites that don't already have a `SqlHelpers` instance. */
export async function ensureUuidColumnsForCurrentDriver(options: { verbose?: boolean } = {}): Promise<void> {
  await ensureUuidColumns(sqlHelpers(getDbDriver()), options)
}
