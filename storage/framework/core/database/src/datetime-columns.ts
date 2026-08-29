/**
 * UTC Datetime Column Guarantee (MySQL)
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
import { env as envVars } from '@stacksjs/env'
import { db } from './utils'
import { dialectCapabilities } from './dialect'
import { traitTableNames } from './trait-tables'

function getDbDriver(): string {
  return process.env.DB_CONNECTION || envVars.DB_CONNECTION || 'sqlite'
}

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

/**
 * Convert every remaining `TIMESTAMP` column on a framework table to
 * `DATETIME`. MySQL-only and idempotent — once converted the
 * `information_schema` query returns nothing and this is a single cheap
 * SELECT.
 */
export async function ensureUtcDatetimeColumns(options: { verbose?: boolean } = {}): Promise<{ success: boolean, converted: number, error?: string }> {
  const driver = getDbDriver()

  // Only MySQL-wire dialects convert on read; SQLite stores text and Postgres'
  // `timestamp without time zone` is already naive.
  if (dialectCapabilities(driver).wire !== 'mysql')
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
