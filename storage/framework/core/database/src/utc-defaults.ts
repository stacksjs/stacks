/**
 * UTC Timestamp Default Guarantee
 *
 * The sibling of `datetime-columns.ts`, and the same shape of bug one step
 * over: that file repairs a column's *type*, this one repairs its *default*.
 *
 * The framework's own tables are created with `CREATE TABLE IF NOT EXISTS`.
 * When their DDL was changed from `DEFAULT CURRENT_TIMESTAMP` to
 * `DEFAULT ${utcNow}`, every new install got the fix and every existing
 * database kept the old default for ever - because the table already exists, so
 * the statement that would have corrected it does nothing, on every migrate,
 * silently.
 *
 * `CURRENT_TIMESTAMP` in a column with no time zone stores the database
 * *session's* local wall clock and drops the offset on the way in. What that
 * leaves is a database where some columns hold UTC and others hold Pacific, all
 * of them typed identically, none of them complaining. Measured on a real
 * instance: eleven columns - `password_resets`, `email_verifications`,
 * `two_factor_challenges`, `two_factor_pending_secrets`, `webauthn_challenges`,
 * the five RBAC tables and the migration ledger - sitting seven hours away from
 * every other row in the same database. Those tables hold the expiry windows of
 * every short-lived credential the framework issues.
 *
 * Idempotent, driver-gated and safe on every `buddy migrate`, exactly like
 * `ensureUuidColumns` and `ensureUtcDatetimeColumns`.
 *
 * ## What it does not do
 *
 * **It does not rewrite existing rows.** The offset in force when each row was
 * written is recorded nowhere, so there is nothing to correct them *with*, and
 * guessing the current offset would be right only for a database that has never
 * moved and never crossed a daylight-saving boundary. The affected tables hold
 * short-lived rows by nature and age out on their own.
 *
 * **It does not add a default to a column that has none.** Only columns whose
 * current default *is* the session clock are altered, which is why this reads
 * `information_schema` rather than issuing a list of blind `ALTER`s: an
 * `updated_at` declared as a nullable timestamp with no default must stay that
 * way.
 */

import process from 'node:process'
import { log } from '@stacksjs/logging'
import { env as envVars } from '@stacksjs/env'
import { db } from './utils'
import { dialectCapabilities } from './dialect'
import { frameworkDatetimeTables } from './datetime-columns'
import { sqlHelpers } from './sql-helpers'

function getDbDriver(): string {
  return process.env.DB_CONNECTION || envVars.DB_CONNECTION || 'sqlite'
}

/** One column whose default is the session's clock rather than UTC. */
export interface SessionClockDefault {
  table: string
  column: string
}

/**
 * The tables this covers: everything `datetime-columns.ts` covers, and the
 * migration ledger.
 *
 * One list rather than two, so a framework table added there is repaired here
 * as well without anybody remembering. `migrations` is added because the ledger
 * is created by its own runner rather than by a table-creator, and it had the
 * same bare default.
 */
export function utcDefaultTables(): string[] {
  return [...frameworkDatetimeTables(), 'migrations']
}

/**
 * Every framework column still defaulting to the session's clock.
 *
 * The schema predicate is the only part that differs between engines -
 * `current_schema()` on Postgres, `DATABASE()` on MySQL - and the test for a
 * bad default is the same on both: it mentions `current_timestamp` (or, on
 * Postgres, the bare `now()`) and does not mention UTC. A default already
 * pinned reads as `(now() AT TIME ZONE 'utc'::text)` or `utc_timestamp()`, and
 * is left alone, as is a column with no default at all.
 */
export async function findSessionClockDefaults(driver: string = getDbDriver()): Promise<SessionClockDefault[]> {
  const schema = dialectCapabilities(driver).wire === 'mysql' ? 'DATABASE()' : 'current_schema()'

  /*
   * Inlined as literals rather than bound, and that is not a shortcut.
   *
   * The two engines do not spell a placeholder the same way - `?` on MySQL,
   * `$1` on Postgres - and `db.unsafe` passes the string through untouched, so
   * a list bound one way is a syntax error on the other. The sibling repair
   * next door gets away with `?` only because it is MySQL-only.
   *
   * These names are `utcDefaultTables()`, a compile-time constant, and every
   * one is checked against the same identifier pattern the `ALTER` below uses.
   * Nothing here comes from a caller.
   */
  const safe = /^[a-z_]\w*$/i
  const names = utcDefaultTables()
    .filter(table => safe.test(table))
    .map(table => `'${table}'`)
    .join(', ')

  const rows = await db.unsafe(
    `SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = ${schema}
      AND table_name IN (${names})
      AND data_type LIKE 'timestamp%'
      AND column_default IS NOT NULL
      AND LOWER(column_default) NOT LIKE '%utc%'
      AND (LOWER(column_default) LIKE '%current_timestamp%' OR LOWER(column_default) = 'now()')`,
  ).execute()

  return (rows as any[]).map(row => ({
    table: String(row.table_name ?? row.TABLE_NAME),
    column: String(row.column_name ?? row.COLUMN_NAME),
  }))
}

/**
 * The `ALTER` that pins one column.
 *
 * Postgres and MySQL 8.0.13+ spell this identically; only the expression
 * differs, which `sqlHelpers.utcNow` already handles.
 *
 * Identifiers come from `information_schema` and are re-validated here before
 * being spliced into DDL, which cannot take a placeholder - the same rule
 * `modifyToDatetimeSql` follows next door.
 */
export function utcDefaultSql(target: SessionClockDefault, driver: string = getDbDriver()): string {
  const safe = /^[a-z_]\w*$/i

  if (!safe.test(target.table) || !safe.test(target.column))
    throw new Error(`[utc-defaults] Refusing to alter unsafe identifier: ${target.table}.${target.column}`)

  return `ALTER TABLE ${target.table} ALTER COLUMN ${target.column} SET DEFAULT ${sqlHelpers(driver).utcNow}`
}

/**
 * Pin every framework timestamp default that is still the session's clock.
 *
 * SQLite is skipped and needs nothing: its `CURRENT_TIMESTAMP` is already UTC,
 * which is exactly what `utcNow` resolves to there, and it cannot alter a
 * column default in any case.
 */
export async function ensureUtcTimestampDefaults(
  options: { verbose?: boolean } = {},
): Promise<{ success: boolean, pinned: number, error?: string }> {
  const driver = getDbDriver()

  if (dialectCapabilities(driver).wire === 'sqlite')
    return { success: true, pinned: 0 }

  try {
    const targets = await findSessionClockDefaults(driver)

    if (targets.length === 0) {
      if (options.verbose)
        log.info('No timestamp defaults left to pin to UTC')

      return { success: true, pinned: 0 }
    }

    for (const target of targets) {
      if (options.verbose)
        log.info(`Pinning ${target.table}.${target.column} default to UTC...`)

      await db.unsafe(utcDefaultSql(target, driver)).execute()
    }

    log.debug(`[utc-defaults] Pinned ${targets.length} timestamp default(s) to UTC`)

    return { success: true, pinned: targets.length }
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    /*
     * Never fail the migrate over this. A column with the old default still
     * works - it is only in the wrong frame - and on a fresh install this runs
     * before the tables exist, where every answer is "nothing to do".
     */
    log.debug(`[utc-defaults] Could not pin timestamp defaults: ${message}`)

    return { success: false, pinned: 0, error: message }
  }
}
