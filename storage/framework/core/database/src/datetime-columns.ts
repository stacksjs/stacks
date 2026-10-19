/**
 * UTC Datetime Column Guarantee (MySQL), and the Postgres mirror of it
 *
 * A MySQL `TIMESTAMP` column is converted FROM the session timezone on write
 * and back TO it on read. The framework stores naive UTC, so on any server
 * whose session timezone isn't UTC the stored instant is shifted — and the
 * same row read from two different sessions yields two different times. A
 * value written as `2026-08-04 01:52:47` comes back as `2026-08-04 14:22:47`
 * from a `+05:30` session.
 *
 * `DATETIME` is MySQL's naive type: it keeps the literal wall-clock value
 * regardless of session or server timezone, which is exactly what SQLite's
 * text columns and Postgres' `timestamp without time zone` already do. The
 * table creators now declare `DATETIME` (see `sqlHelpers.datetime`), but
 * `CREATE TABLE IF NOT EXISTS` never alters a table that already exists —
 * so every database migrated before that change keeps its `TIMESTAMP`
 * columns and stays broken.
 *
 * This is the ALTER that repairs them. Same shape as `ensureUuidColumns`:
 * idempotent, driver-gated, and safe to run on every `buddy migrate`.
 *
 * Postgres has the same failure in mirror image. Its naive type is
 * `timestamp without time zone`, which the table creators declare, and a
 * column that is `timestamp with time zone` instead shifts every value the
 * framework writes into it by the session timezone's offset - because the
 * framework writes a naive literal and Postgres interprets one written into an
 * aware column in that zone (stacksjs/stacks#2902). Those columns are reported
 * rather than altered by default; see `ensureNaiveTimestampColumns` below.
 *
 * ## Why the conversion preserves the intended value
 *
 * `ALTER TABLE … MODIFY col DATETIME` reads each `TIMESTAMP` back through the
 * session timezone and stores that wall-clock literal. Since the rows were
 * written through that same session timezone, the value that comes out is
 * the literal the application originally wrote — the shift introduced on
 * write is undone by the read, and what lands in the `DATETIME` column is the
 * intended UTC value. Rows written under a *different* session timezone (a
 * server that moved, or a DST boundary) were already inconsistent with each
 * other and cannot be recovered by any conversion.
 *
 * Pinning the session timezone instead would have been the other way to fix
 * this, but it is not reachable: Bun's `SQL` is a connection pool that
 * exposes no connection-string parameter, option, or connect hook for it, so
 * a `SET time_zone` applies to one pooled connection and every other
 * connection keeps the server default (measured: 7 of 8 connections missed
 * it).
 */

import process from 'node:process'
import { log } from '@stacksjs/logging'
import { db } from './utils'
import { dialectCapabilities, resolvedDatabaseDriver } from './dialect'
import { traitTableNames } from './trait-tables'

/**
 * The framework-owned tables whose datetime columns this guarantee covers.
 *
 * Model-backed tables are deliberately absent: their columns come from the
 * migration generator, which is a separate path with its own column types.
 */
export function frameworkDatetimeTables(): string[] {
  return [
    // trait-tables.ts — these shipped briefly with VARCHAR timestamp columns
    // before `sqlDateTime()` made a real datetime column workable on MySQL.
    ...traitTableNames(),
    // auth-tables.ts
    'passkeys',
    'password_resets',
    // Created by `migrateAuthTables` alongside the rest and missing from this
    // list until `utc-defaults.ts` derived its own from it and noticed.
    'email_verifications',
    'oauth_clients',
    'oauth_access_tokens',
    'oauth_refresh_tokens',
    'two_factor_challenges',
    'two_factor_pending_secrets',
    'webauthn_challenges',
    'oauth_flows',
    // rbac-tables.ts
    'roles',
    'permissions',
    'user_roles',
    'user_permissions',
    'role_permissions',
    // notification-tables.ts
    'notifications',
    'notification_preferences',
    'notification_deliveries',
  ]
}

interface TimestampColumn {
  table: string
  column: string
  nullable: boolean
  /** The column's existing DEFAULT, verbatim, or null when it has none. */
  columnDefault: string | null
  /** e.g. `DEFAULT_GENERATED on update CURRENT_TIMESTAMP` */
  extra: string
}

/**
 * Every `TIMESTAMP` column still present on a framework table.
 *
 * Reads `information_schema` rather than `SHOW COLUMNS` so the query is a
 * single round-trip and can be filtered to the current schema.
 */
export async function findTimestampColumns(): Promise<TimestampColumn[]> {
  const tables = frameworkDatetimeTables()
  const placeholders = tables.map(() => '?').join(', ')

  // `varchar` is matched too, and only for the two timestamp column names:
  // the trait tables shipped briefly with VARCHAR(64) here, and a database
  // migrated in that window needs the same repair. Restricting to
  // created_at/updated_at keeps a legitimate text column from being caught.
  const rows = await db.unsafe(
    `SELECT TABLE_NAME, COLUMN_NAME, IS_NULLABLE, COLUMN_DEFAULT, EXTRA
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME IN (${placeholders})
      AND (
        DATA_TYPE = 'timestamp'
        OR (DATA_TYPE = 'varchar' AND COLUMN_NAME IN ('created_at', 'updated_at'))
      )`,
    tables,
  ).execute()

  // An information_schema result: MySQL answers upper-case column names,
  // Postgres lower-case, which is why each field is read both ways. Every read
  // is coerced below, so the generic row shape is enough.
  return (rows as Array<Record<string, unknown>>).map(row => ({
    table: String(row.TABLE_NAME ?? row.table_name),
    column: String(row.COLUMN_NAME ?? row.column_name),
    nullable: String(row.IS_NULLABLE ?? row.is_nullable).toUpperCase() === 'YES',
    // Coerced like its neighbours: the driver hands back whatever the column
    // default is, and TimestampColumn declares a string.
    columnDefault: ((row.COLUMN_DEFAULT ?? row.column_default) ?? null) as string | null,
    extra: String(row.EXTRA ?? row.extra ?? ''),
  }))
}

/**
 * The `MODIFY` that converts one column, preserving its nullability, default
 * and any `ON UPDATE CURRENT_TIMESTAMP` clause.
 *
 * Identifiers come from `information_schema` and are re-validated here before
 * being spliced into DDL, which cannot take a placeholder.
 */
export function modifyToDatetimeSql(column: TimestampColumn): string {
  const safe = /^[a-z_]\w*$/i
  if (!safe.test(column.table) || !safe.test(column.column))
    throw new Error(`[datetime-columns] Refusing to alter unsafe identifier: ${column.table}.${column.column}`)

  let ddl = `ALTER TABLE \`${column.table}\` MODIFY \`${column.column}\` DATETIME`
  ddl += column.nullable ? ' NULL' : ' NOT NULL'

  if (column.columnDefault !== null) {
    // CURRENT_TIMESTAMP is a function, not a literal, so it must not be quoted.
    const isFunction = /^CURRENT_TIMESTAMP(\(\d*\))?$/i.test(String(column.columnDefault))
    ddl += isFunction
      ? ` DEFAULT ${column.columnDefault}`
      : ` DEFAULT '${String(column.columnDefault).replace(/'/g, "''")}'`
  }

  if (/on update CURRENT_TIMESTAMP/i.test(column.extra))
    ddl += ' ON UPDATE CURRENT_TIMESTAMP'

  return ddl
}

/** Environment escape hatch: convert the columns instead of reporting them. */
export const AWARE_TIMESTAMP_CONVERSION_ENV = 'STACKS_CONVERT_AWARE_TIMESTAMPS'

/** Whether an operator asked for the conversion rather than the report. */
export function convertAwareTimestampsRequested(env: Record<string, string | undefined> = process.env): boolean {
  const raw = env[AWARE_TIMESTAMP_CONVERSION_ENV]?.trim().toLowerCase()
  return raw === '1' || raw === 'true'
}

/** A framework column Postgres stores WITH a timezone, against the convention. */
export interface AwareTimestampColumn {
  table: string
  column: string
}

/**
 * Framework columns Postgres holds as `timestamp with time zone`.
 *
 * The framework writes a naive literal (`sqlDateTime()`, no offset) and
 * Postgres interprets one written into an aware column in the SESSION
 * timezone, so on any server whose zone is not UTC the stored instant is
 * shifted by that offset. Measured: with the session zone at `Asia/Manila`,
 * `2026-10-14T12:00:00.000` into `timestamptz` reads back as
 * `2026-10-14T04:00:00.000Z`, and that is enough to make token issuance fail
 * with `Failed to persist the requested access token`, because the
 * read-back check compares the stored expiry against the instant it asked for
 * and the two genuinely differ (stacksjs/stacks#2902).
 *
 * The table creators declare `timestamp without time zone`, so a database the
 * framework built has none of these. One appears from a hand-written
 * migration, an older corpus, or a restore from a database that had them.
 */
export async function findAwareTimestampColumns(): Promise<AwareTimestampColumn[]> {
  const tables = frameworkDatetimeTables()
  const placeholders = tables.map((_, index) => `$${index + 1}`).join(', ')

  const rows = await db.unsafe(
    `SELECT table_name, column_name
     FROM information_schema.columns
     WHERE table_schema = current_schema()
       AND table_name IN (${placeholders})
       AND data_type = 'timestamp with time zone'
     ORDER BY table_name, column_name`,
    tables,
  ).execute()

  return (rows as Array<Record<string, unknown>>).map(row => ({
    table: String(row.table_name ?? row.TABLE_NAME),
    column: String(row.column_name ?? row.COLUMN_NAME),
  }))
}

/**
 * The `ALTER` that makes one aware column naive.
 *
 * The cast reads the stored instant through the session timezone, which is the
 * same interpretation applied when the naive literal was written, so what
 * lands in the naive column is the literal the application originally wrote.
 * Rows written under a *different* session zone - a server that moved, or a
 * DST boundary - were already inconsistent with each other and no conversion
 * recovers them. Exactly the reasoning the MySQL pass above rests on.
 *
 * Identifiers come from `information_schema` and are re-validated here before
 * being spliced into DDL, which cannot take a placeholder.
 */
export function convertToNaiveSql(column: AwareTimestampColumn): string {
  const safe = /^[a-z_]\w*$/i
  if (!safe.test(column.table) || !safe.test(column.column))
    throw new Error(`[datetime-columns] Refusing to alter unsafe identifier: ${column.table}.${column.column}`)

  return `ALTER TABLE "${column.table}" ALTER COLUMN "${column.column}" TYPE timestamp USING "${column.column}"::timestamp`
}

/**
 * What an operator is told when a framework table holds an aware column.
 *
 * Reported rather than converted, because the repair is DDL on a column that
 * may be large and is someone else's data. The flag converts.
 */
export function formatAwareTimestampWarning(columns: readonly AwareTimestampColumn[]): string {
  const sample = columns.slice(0, 5).map(column => `  ${column.table}.${column.column}`)

  return [
    `[datetime-columns] ${columns.length} framework column(s) are \`timestamp with time zone\`, which this framework does not write correctly:`,
    ...sample,
    columns.length > sample.length ? `  ... and ${columns.length - sample.length} more` : '',
    '',
    'The framework writes a naive UTC literal, and Postgres reads one written into an aware column in the session',
    'timezone, so every timestamp in these columns is shifted by that offset. A read-back check comparing a stored',
    'expiry against the instant it asked for then fails, which surfaces as a 500 about persistence (#2902).',
    '',
    `Convert them in place, preserving what the application wrote: re-run with ${AWARE_TIMESTAMP_CONVERSION_ENV}=1, or`,
    'by hand:',
    ...columns.slice(0, 5).map(column => `  ${convertToNaiveSql(column)};`),
  ].filter(line => line !== '').join('\n')
}

/**
 * Convert every remaining `TIMESTAMP` column on a framework table to
 * `DATETIME`. MySQL-only and idempotent — once converted the
 * `information_schema` query returns nothing and this is a single cheap
 * SELECT.
 */
export async function ensureUtcDatetimeColumns(options: { verbose?: boolean } = {}): Promise<{ success: boolean, converted: number, error?: string }> {
  const driver = resolvedDatabaseDriver()
  const wire = dialectCapabilities(driver).wire

  // Postgres keeps the framework's convention for as long as its columns are
  // naive, which the table creators make them. One that is aware shifts every
  // timestamp it holds, so it is reported - or, behind the flag, repaired.
  if (wire === 'postgres')
    return await ensureNaiveTimestampColumns(options)

  // Only MySQL-wire dialects convert on read; SQLite stores text.
  if (wire !== 'mysql')
    return { success: true, converted: 0 }

  try {
    const columns = await findTimestampColumns()
    if (columns.length === 0) {
      if (options.verbose) log.info('No TIMESTAMP columns left to convert')
      return { success: true, converted: 0 }
    }

    for (const column of columns) {
      if (options.verbose) log.info(`Converting ${column.table}.${column.column} to DATETIME...`)
      await db.unsafe(modifyToDatetimeSql(column)).execute()
    }

    log.debug(`[datetime-columns] Converted ${columns.length} TIMESTAMP column(s) to DATETIME`)
    return { success: true, converted: columns.length }
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    // Never fail the migrate over this: an un-converted column still works,
    // it is only timezone-fragile.
    log.error(`Failed to convert TIMESTAMP columns to DATETIME: ${message}`)
    return { success: false, converted: 0, error: message }
  }
}

/**
 * Report, or behind {@link AWARE_TIMESTAMP_CONVERSION_ENV} repair, every
 * framework column Postgres holds with a timezone.
 *
 * Reporting is the default because the repair is DDL on someone else's data:
 * it rewrites a column that may be large, and on a table the application is
 * serving. An operator who reads the message can run it in a window of their
 * choosing, with the statement printed for them, or set the flag and let the
 * next migrate do it.
 *
 * Idempotent either way: once a column is naive the query returns nothing and
 * this is a single cheap SELECT.
 */
async function ensureNaiveTimestampColumns(options: { verbose?: boolean }): Promise<{ success: boolean, converted: number, error?: string }> {
  try {
    const columns = await findAwareTimestampColumns()
    if (columns.length === 0) {
      if (options.verbose) log.info('No aware timestamp columns on framework tables')
      return { success: true, converted: 0 }
    }

    if (!convertAwareTimestampsRequested()) {
      log.warn(formatAwareTimestampWarning(columns))
      return { success: true, converted: 0 }
    }

    for (const column of columns) {
      if (options.verbose) log.info(`Converting ${column.table}.${column.column} to a naive timestamp...`)
      await db.unsafe(convertToNaiveSql(column)).execute()
    }

    log.debug(`[datetime-columns] Converted ${columns.length} aware timestamp column(s) to naive`)
    return { success: true, converted: columns.length }
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    // Never fail the migrate over this, for the same reason the MySQL pass does
    // not: the column still works, it is only timezone-fragile.
    log.error(`Failed to inspect aware timestamp columns: ${message}`)
    return { success: false, converted: 0, error: message }
  }
}
