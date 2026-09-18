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

import process from 'node:process'
import { env as envVars } from '@stacksjs/env'
import { mutationCount } from './affected-rows'
import { dialectCapabilities, isKnownDialect } from './dialect'
import { db } from './utils'

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
 *   - SQLite has no `ALTER COLUMN`, so a NOT NULL column is added in one
 *     statement and needs a `defaultValue` to fill the existing rows; without
 *     one this throws before touching the table
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
  const dbAny = db
  const wire = wireProtocol()
  const defaultSql = defaultValue === undefined
    ? ''
    : ` DEFAULT ${formatDefault(defaultValue)}`

  // SQLite cannot add a constraint to an existing column: `ALTER TABLE ...
  // ALTER COLUMN` is not syntax it has, and the previous code emitted it
  // anyway, so `notNull: true` always threw there, AFTER the column had been
  // added and left nullable. What SQLite does allow is adding the column NOT
  // NULL in one statement, as long as a default fills the existing rows.
  if (wire === 'sqlite') {
    if (notNull && defaultValue === undefined) {
      throw new Error(
        `Cannot add NOT NULL column ${JSON.stringify(columnName)} to ${JSON.stringify(tableName)} on SQLite without a defaultValue: `
        + 'SQLite has no ALTER COLUMN, so the constraint has to be part of the ADD COLUMN, which needs a value for the existing rows.',
      )
    }
    const notNullSql = notNull ? ' NOT NULL' : ''
    await execRaw(dbAny, `ALTER TABLE ${quote(tableName)} ADD COLUMN ${quote(columnName)} ${type}${notNullSql}${defaultSql}`)
    return
  }

  // 1. Add the column as nullable + with default. Default-bearing column
  //    additions are O(1) on Postgres ≥ 11 and MySQL ≥ 8 because the
  //    default is stored as table metadata, not written into every row.
  await execRaw(dbAny, `ALTER TABLE ${quote(tableName)} ADD COLUMN ${quote(columnName)} ${type}${defaultSql}`)

  if (defaultValue !== undefined) {
    // 2. Backfill any rows that were inserted *before* the metadata
    //    default was wired (rare: Postgres >= 11 covers this with the
    //    fast-path default; we still do an explicit UPDATE in batches
    //    to handle the older-DB fallback).
    await backfillInBatches(db, tableName, columnName, defaultValue, batchSize)
  }

  // 3. Add the NOT NULL constraint at the end. By now every row has
  //    a value, so the validation phase is fast.
  //
  // MySQL has no `ALTER COLUMN ... SET NOT NULL`. Its MODIFY COLUMN restates
  // the whole definition, and a restatement that leaves the default out drops
  // it, so the default is repeated here.
  if (notNull) {
    await execRaw(dbAny, wire === 'mysql'
      ? `ALTER TABLE ${quote(tableName)} MODIFY COLUMN ${quote(columnName)} ${type} NOT NULL${defaultSql}`
      : `ALTER TABLE ${quote(tableName)} ALTER COLUMN ${quote(columnName)} SET NOT NULL`)
  }
}

/**
 * Run a raw DDL string against the active connection. We can't use
 * `sql\`...\`.execute(db)` here because the SQL is variable-shaped and
 * the tagged-template form doesn't accept a string-as-prefix. The
 * underlying driver's `unsafe()` is the canonical hatch for this.
 */
/**
 * What these helpers need off the connection to run DDL.
 *
 * Matches `Db.unsafe`'s own signature. Its declared result is the ROWS a
 * SELECT returns, while a write resolves to the driver's own result, so it is
 * returned untyped and read through mutationCount.
 */
interface DdlRunner {
  unsafe?: (_query: string, _params?: unknown[]) => Promise<unknown>
}

async function execRaw(dbAny: DdlRunner, statement: string): Promise<unknown> {
  if (typeof dbAny.unsafe === 'function')
    return await dbAny.unsafe(statement)

  /*
   * No `unsafe()` on this connection, and nothing else here can run raw DDL.
   *
   * This used to reach for `sql`…`.execute(db)`, which the docblock above
   * already explains cannot work - and the fragment `sql` builds carries only
   * `sql`, `parameters`, `as` and `toString`, so the call was a TypeError
   * rather than the fallback it was written as. Saying so is more use than
   * crashing inside a migration with "execute is not a function".
   */
  throw new TypeError(
    'This database connection exposes no `unsafe()`, which is the only way these '
    + `safe-migration helpers can run raw DDL. Statement: ${statement}`,
  )
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
  // Filling NULLs with NULL changes nothing, and it would never finish: SQLite
  // and PostgreSQL count the rows an UPDATE matches, so every pass would match
  // the same rows again.
  if (value === null)
    return

  const dbAny = db
  const wire = wireProtocol()
  let updated = 0
  do {
    // MySQL takes a LIMIT on UPDATE directly. It rejects one inside an IN
    // subquery (error 1235) and rejects selecting from the table being
    // updated (error 1093), so the form the other two use cannot run there.
    // PostgreSQL and SQLite have no LIMIT on UPDATE, but do have a system
    // row identifier to select on.
    const batchSql = wire === 'mysql'
      ? `
      UPDATE ${quote(tableName)} SET ${quote(columnName)} = ${formatDefault(value)}
      WHERE ${quote(columnName)} IS NULL
      LIMIT ${batchSize}
    `
      : `
      UPDATE ${quote(tableName)} SET ${quote(columnName)} = ${formatDefault(value)}
      WHERE ${quote(columnName)} IS NULL
        AND ${rowIdColumn(wire)} IN (
          SELECT ${rowIdColumn(wire)} FROM ${quote(tableName)}
          WHERE ${quote(columnName)} IS NULL
          LIMIT ${batchSize}
        )
    `
    // No driver sets `numAffectedRows`, which this used to read, so every
    // backfill stopped after its first batch and left the rest NULL.
    updated = mutationCount(await execRaw(dbAny, batchSql))
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
  const dbAny = db
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

/**
 * The wire protocol of the configured connection.
 *
 * These helpers emit DDL by hand, and DDL is where the dialects differ most,
 * so every statement below is built for one of these three. SingleStore and
 * Vitess collapse onto `mysql`, which is what their DDL wants too.
 */
function wireProtocol(): 'sqlite' | 'mysql' | 'postgres' {
  const driver = String(process.env.DB_CONNECTION || envVars.DB_CONNECTION || 'sqlite').toLowerCase()
  return isKnownDialect(driver) ? dialectCapabilities(driver).wire : 'sqlite'
}

/**
 * Quote an identifier (table or column name) for safe inclusion in raw SQL.
 *
 * MySQL reads `"name"` as a string literal rather than an identifier unless
 * the session runs with ANSI_QUOTES, which Stacks does not set, so every
 * statement in this file used to fail there with a syntax error.
 */
function quote(name: string): string {
  if (!/^[a-z_][a-z0-9_]*$/i.test(name)) {
    throw new Error(`Refusing to quote unsafe identifier: ${JSON.stringify(name)}`)
  }
  const quoteChar = wireProtocol() === 'mysql' ? '`' : '"'
  return `${quoteChar}${name}${quoteChar}`
}

function formatDefault(value: string | number | boolean | null): string {
  if (value === null) return 'NULL'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  return `'${String(value).replace(/'/g, '\'\'')}'`
}

/**
 * The row identifier a batched UPDATE can select on: PostgreSQL's `ctid` and
 * SQLite's `rowid` are system columns every table has. MySQL has no such
 * column, and needs none, because it accepts `UPDATE ... LIMIT` directly.
 *
 * This used to return `'id'` for every dialect, which assumed a primary key
 * by that name: a table keyed by `uuid` failed with `no such column: id`.
 */
function rowIdColumn(wire: 'sqlite' | 'postgres'): string {
  return wire === 'postgres' ? 'ctid' : 'rowid'
}
