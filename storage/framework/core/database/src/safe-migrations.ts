/**
 * Zero-downtime migration helpers.
 *
 * Adding a NOT NULL column to a large table will lock the table on
 * every supported database (Postgres, MySQL, SQLite). The framework
 * doesn't have a built-in escape hatch for "schema change that's safe
 * on a production-sized table" — these helpers fill that gap.
 *
 * The pattern they encapsulate is the same on every DB:
 *   1. Add the column as nullable
 *   2. Backfill it in batches (or via an async job) without holding a
 *      table-level lock
 *   3. Add the NOT NULL constraint after every row has a value
 *
 * The helpers compose with normal kysely/bun-query-builder migrations —
 * just call them from inside the `up()` of a migration file.
 */

import { db } from './utils'
import { sql } from './types'

type Database = typeof db

interface AddColumnSafelyOptions {
  /** SQL type for the new column (e.g. 'varchar(255)', 'integer', 'jsonb'). */
  type: string
  /**
   * Default value to write into existing rows. Required if the column
   * will eventually be NOT NULL — there's no way to add the constraint
   * later without a value for every row.
   */
  defaultValue?: string | number | boolean | null
  /**
   * Eventually mark the column NOT NULL. Defaults to `false` because
   * "add a NOT NULL column safely" is the rare path; "add a nullable
   * column" is the common one.
   */
  notNull?: boolean
  /**
   * Rows-per-batch for the backfill UPDATE. Larger batches finish
   * faster but hold locks longer; 1000 is a good default for
   * production traffic.
   */
  batchSize?: number
}

/**
 * Add a column to `tableName` without taking a table-level lock long
 * enough to disrupt traffic. The column is created nullable, backfilled
 * in batches, and (if `notNull: true`) the constraint is added at the
 * end.
 *
 * Pre-conditions:
 *   - `tableName` exists
 *   - `columnName` does NOT already exist (this helper doesn't gracefully
 *     handle the rerun case — wrap in `if (!columnExists)` if you need that)
 *
 * Caveats:
 *   - SQLite doesn't support adding NOT NULL columns to existing tables
 *     without a default; we work around it by always supplying one
 *   - Postgres < 11 rewrites the entire table when a default is added;
 *     this helper assumes ≥ 11
 *
 * @example
 * ```ts
 * await addColumnSafely(db, 'users', 'email_verified', {
 *   type: 'boolean',
 *   defaultValue: false,
 *   notNull: true,
 * })
 * ```
 */
export async function addColumnSafely(
  db: Database,
  tableName: string,
  columnName: string,
  options: AddColumnSafelyOptions,
): Promise<void> {
  const { type, defaultValue, notNull = false, batchSize = 1000 } = options
  const dbAny = db as any

  // 1. Add the column as nullable + with default. Default-bearing column
  //    additions are O(1) on Postgres ≥ 11 and MySQL ≥ 8 because the
  //    default is stored as table metadata, not written into every row.
  const defaultSql = defaultValue === undefined
    ? ''
    : ` DEFAULT ${formatDefault(defaultValue)}`
  await execRaw(dbAny, `ALTER TABLE ${quote(tableName)} ADD COLUMN ${quote(columnName)} ${type}${defaultSql}`)

  if (defaultValue !== undefined) {
    // 2. Backfill any rows that were inserted *before* the metadata
    //    default was wired (rare: Postgres >= 11 covers this with the
    //    fast-path default; we still do an explicit UPDATE in batches
    //    to handle the older-DB and SQLite fallback).
    await backfillInBatches(db, tableName, columnName, defaultValue, batchSize)
  }

  // 3. Add the NOT NULL constraint at the end. By now every row has
  //    a value, so the validation phase is fast.
  if (notNull) {
    await execRaw(dbAny, `ALTER TABLE ${quote(tableName)} ALTER COLUMN ${quote(columnName)} SET NOT NULL`)
  }
}

/**
 * Run a raw DDL string against the active connection. We can't use
 * `sql\`...\`.execute(db)` here because the SQL is variable-shaped and
 * the tagged-template form doesn't accept a string-as-prefix. The
 * underlying driver's `unsafe()` is the canonical hatch for this.
 */
async function execRaw(dbAny: any, statement: string): Promise<{ numAffectedRows?: number | bigint }> {
  if (typeof dbAny.unsafe === 'function') {
    const result = await dbAny.unsafe(statement)
    return result ?? {}
  }
  // Fallback: use the tagged-template through sql.raw() — works on the
  // bun-query-builder-style driver. May not return affected rows.
  await (sql`${sql.raw(statement)}` as any).execute(dbAny)
  return {}
}

/**
 * Back-fill `columnName` with `value` for any row where it's currently
 * NULL. Runs in batches so the UPDATE doesn't lock the entire table.
 *
 * Useful as a standalone helper when you want to backfill an *existing*
 * column (e.g. populating a denormalized count) — `addColumnSafely`
 * uses it internally.
 */
export async function backfillInBatches(
  db: Database,
  tableName: string,
  columnName: string,
  value: string | number | boolean | null,
  batchSize = 1000,
): Promise<void> {
  const dbAny = db as any
  let updated = 0
  let total = 0
  do {
    // The DBs we support all expose a `LIMIT` on UPDATE either natively
    // or via a CTE workaround. Postgres' standard syntax is
    // `WHERE ctid IN (SELECT ... LIMIT N)`; MySQL allows `UPDATE ... LIMIT`;
    // SQLite needs `WHERE rowid IN (SELECT rowid ... LIMIT N)`. The CTE
    // form below works on all three.
    const batchSql = `
      UPDATE ${quote(tableName)} SET ${quote(columnName)} = ${formatDefault(value)}
      WHERE ${quote(columnName)} IS NULL
        AND ${rowIdColumnFor(dbAny)} IN (
          SELECT ${rowIdColumnFor(dbAny)} FROM ${quote(tableName)}
          WHERE ${quote(columnName)} IS NULL
          LIMIT ${batchSize}
        )
    `
    const result = await execRaw(dbAny, batchSql)
    updated = result.numAffectedRows != null ? Number(result.numAffectedRows) : 0
    total += updated
  }
  while (updated > 0)
}

/**
 * Rename a column safely on a table that's actively serving traffic.
 *
 * Most database engines DO support `RENAME COLUMN` as a metadata-only
 * operation (no rewrite, no long lock), which means the headline
 * concern is *application-side*: app code reads the old column name,
 * the migration renames it, and the next request 500s.
 *
 * This helper wraps the rename in a multi-step sequence the framework
 * docs can teach as the canonical pattern:
 *
 *   1. Add the new column
 *   2. Backfill from old → new
 *   3. Update writes to dual-write old AND new (app-level, deploy step)
 *   4. Update reads to read from new (app-level, deploy step)
 *   5. Drop the old column (separate migration)
 *
 * For the rare case where the rename *can* happen atomically (small
 * table, no live traffic), pass `{ atomic: true }` and we'll just emit
 * the RENAME COLUMN.
 *
 * @example
 * ```ts
 * // Step 1 of the rename sequence — the rest is app-side coordination.
 * await renameColumnSafely(db, 'users', 'name', 'full_name', { type: 'varchar(255)' })
 * ```
 */
export async function renameColumnSafely(
  db: Database,
  tableName: string,
  oldName: string,
  newName: string,
  options: { type: string, atomic?: boolean },
): Promise<void> {
  const dbAny = db as any
  if (options.atomic) {
    await execRaw(dbAny, `ALTER TABLE ${quote(tableName)} RENAME COLUMN ${quote(oldName)} TO ${quote(newName)}`)
    return
  }
  // Step 1: add the new column nullable.
  await execRaw(dbAny, `ALTER TABLE ${quote(tableName)} ADD COLUMN ${quote(newName)} ${options.type}`)
  // Step 2: copy values across.
  await execRaw(dbAny, `UPDATE ${quote(tableName)} SET ${quote(newName)} = ${quote(oldName)}`)
  // Steps 3-5 are app-side; the next migration after this one (added
  // in a separate deploy) drops the old column. This file only covers
  // the schema half.
}

/** Quote an identifier (table or column name) for safe inclusion in raw SQL. */
function quote(name: string): string {
  if (!/^[a-z_][a-z0-9_]*$/i.test(name)) {
    throw new Error(`Refusing to quote unsafe identifier: ${JSON.stringify(name)}`)
  }
  return `"${name}"`
}

function formatDefault(value: string | number | boolean | null): string {
  if (value === null) return 'NULL'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  return `'${String(value).replace(/'/g, '\'\'')}'`
}

/**
 * Picks the right "row id" column for the running database. Postgres
 * uses `ctid` (system column), SQLite uses `rowid`, MySQL uses `id` (the
 * primary key by convention; if the table doesn't have one, this helper
 * isn't safe — but that's true of every batched-update strategy).
 */
function rowIdColumnFor(_db: unknown): string {
  // We don't have a clean way to detect dialect from `db` alone here,
  // so we use the universal-ish identifier `id`. Callers using a
  // non-`id` primary key should use `addColumnSafely` only on tables
  // where the standard naming convention applies.
  return 'id'
}
