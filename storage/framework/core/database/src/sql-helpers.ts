/**
 * SQL Dialect Helpers
 *
 * Cross-database compatibility utilities for PostgreSQL, MySQL, and SQLite.
 * Centralizes the isPostgres/isMysql/now/boolTrue/boolFalse/param helpers
 * that were previously duplicated across tokens.ts, auth-tables.ts, and setup.ts.
 *
 * Dialect classification itself lives in `./dialect` — this module renders
 * SQL fragments, that one decides what each dialect is.
 */

import { dialectCapabilities } from './dialect'

export interface SqlDialectHelpers {
  driver: string
  isPostgres: boolean
  isMysql: boolean
  isSqlite: boolean
  /** SQL expression for current timestamp */
  now: string
  /** SQL literal for boolean true */
  boolTrue: string
  /** SQL literal for boolean false */
  boolFalse: string
  /** Auto-increment column type */
  autoIncrement: string
  /** Primary key suffix */
  primaryKey: string
  /**
   * Full DDL for an `id` primary-key column. Composes the dialect-specific
   * auto-increment + primary-key fragments so callers can write one CREATE
   * TABLE per table instead of branching per dialect.
   * Postgres → `id SERIAL PRIMARY KEY`
   * MySQL   → `id INTEGER PRIMARY KEY AUTO_INCREMENT`
   * SQLite  → `id INTEGER PRIMARY KEY AUTOINCREMENT`
   */
  pkColumn: string
  /**
   * Column type for a naive UTC datetime.
   *
   * `DATETIME` on MySQL, not `TIMESTAMP`. A MySQL `TIMESTAMP` is converted
   * from the session timezone on write and back to it on read, so the same
   * row read from two sessions yields two different instants — a value
   * written as `01:52:47` comes back as `14:22:47` from a `+05:30` session.
   * The framework stores naive UTC, and `DATETIME` is MySQL's naive type: it
   * keeps the literal wall-clock value regardless of session or server
   * timezone, matching SQLite's text columns and Postgres'
   * `timestamp without time zone`.
   *
   * Bun's `SQL` is a connection pool and exposes no connection-string
   * parameter, option, or connect hook for the session timezone, so pinning
   * it to UTC is not reachable — a `SET time_zone` lands on one pooled
   * connection and every other connection keeps the server default. The
   * column type is the only place this can be fixed reliably.
   */
  datetime: string
  /**
   * DDL fragment for a nullable datetime column.
   * MySQL needs an explicit `NULL` modifier — without it, the column is
   * implicitly NOT NULL (with `0000-00-00 00:00:00` as the default), which
   * trips the strict-mode insert path. Postgres and SQLite are nullable by
   * default, so the modifier is omitted.
   */
  nullableTimestamp: string
  /**
   * Positional parameter placeholder.
   * PostgreSQL uses $1, $2, ...; MySQL/SQLite use ?.
   */
  param: (index: number) => string
  /**
   * Build parameter placeholders for multiple values.
   * Returns { sql: '$1, $2, $3', values: [...] } (Postgres)
   * or     { sql: '?, ?, ?', values: [...] } (MySQL/SQLite)
   */
  params: (...values: unknown[]) => { sql: string, values: unknown[] }
}

/**
 * The framework's canonical datetime literal: ISO-8601 UTC **without** the
 * trailing `Z` (`2026-08-04T01:52:47.417`).
 *
 * One format for every dialect, because the alternatives are all broken:
 *
 * - `new Date().toISOString()` — what the framework used to write — is
 *   rejected outright by MySQL in strict mode ("Incorrect datetime value"),
 *   so any insert into a TIMESTAMP column threw. Dropping the `Z` is the
 *   whole difference; MySQL accepts the rest of the ISO shape.
 * - A space-separated literal (`2026-08-04 01:52:47`) is accepted everywhere
 *   but sorts BEFORE an ISO string on SQLite, where these columns hold text.
 *   Mixing it with already-stored ISO rows would corrupt every ordering and
 *   range query over existing data.
 *
 * Keeping the `T` and dropping only the `Z` satisfies all three engines and
 * still sorts correctly against rows written in the old format, since the
 * value is a prefix of the old one for the same instant.
 *
 * Use this for every app-generated timestamp written to, or compared against,
 * a framework table — never the raw `toISOString()`, and never the database's
 * own clock (see below).
 *
 * ## Do not compare these against `NOW()` / `datetime('now')`
 *
 * The DB clock renders as `2026-08-04 01:52:47` — space-separated. On SQLite
 * these columns are text, and `'T' > ' '`, so an ISO value always compares
 * greater than a same-day DB-clock value regardless of the actual instant.
 * That silently made every `expires_at > datetime('now')` check pass for
 * already-expired rows. Compare app-written columns against `sqlDateTime()`.
 */
export function sqlDateTime(value: Date = new Date()): string {
  return value.toISOString().slice(0, -1)
}

/**
 * {@link sqlDateTime} pre-quoted for interpolation into a raw SQL string.
 * The value is generated from a `Date`, never from user input, so it cannot
 * carry a quote to escape.
 */
export function sqlDateTimeLiteral(value: Date = new Date()): string {
  return `'${sqlDateTime(value)}'`
}

/**
 * Read a timestamp back out of a framework table.
 *
 * The counterpart to {@link sqlDateTime}, and mandatory wherever a stored
 * timestamp is compared in JavaScript. `new Date('2026-08-04T01:52:47.417')`
 * — an ISO date-time with no offset — is parsed as **local** time per the ES
 * spec, while the same string with a `Z` is UTC. Since the stored format
 * cannot carry the `Z` (MySQL rejects it), a bare `new Date(...)` on these
 * values silently shifts every comparison by the host's UTC offset. Only a
 * server already running in UTC would look correct.
 *
 * Accepts every shape these columns hold: the canonical `T` format, the
 * space-separated form the database clocks emit, values that still carry a
 * `Z` or an explicit offset from before this format existed, and the `Date`
 * objects the MySQL driver hands back. Anything without an explicit offset is
 * read as UTC, which is what the framework writes.
 *
 * Returns null for missing or unparseable input so callers can fail closed
 * rather than treating a bad value as the epoch.
 */
export function parseSqlDateTime(value: unknown): Date | null {
  if (value === null || value === undefined)
    return null
  if (value instanceof Date)
    return Number.isNaN(value.getTime()) ? null : value
  if (typeof value === 'number')
    return Number.isNaN(value) ? null : new Date(value)
  if (typeof value !== 'string')
    return null

  const trimmed = value.trim()
  if (!trimmed)
    return null

  // `2026-08-04 01:52:47` -> `2026-08-04T01:52:47`
  let normalized = trimmed.replace(' ', 'T')
  // No `Z` and no `±HH:MM` / `±HHMM` offset means the value is UTC by
  // convention, so say so explicitly rather than letting JS assume local.
  if (!/(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized))
    normalized += 'Z'

  const parsed = new Date(normalized)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

/**
 * Create SQL dialect helpers for a given driver.
 *
 * @example
 * ```ts
 * import { sqlHelpers } from '@stacksjs/database'
 * const sql = sqlHelpers('postgres')
 * await db.unsafe(`SELECT * FROM users WHERE id = ${sql.param(1)}`, [userId])
 * ```
 */
export function sqlHelpers(driver: string): SqlDialectHelpers {
  // Wire protocol, not feature set: this function only decides how SQL is
  // rendered (placeholders, quoting, `NOW()` vs `datetime('now')`), and every
  // MySQL-wire dialect renders identically. What each one *accepts* in DDL
  // varies and is answered by `dialectCapabilities()` instead.
  //
  // Before this delegated to the capability table, each dialect check was an
  // inline `=== 'mysql' || === 'singlestore'` and a new MySQL-wire dialect
  // that missed one fell through to the SQLite branch — emitting
  // `datetime('now')` and `AUTOINCREMENT` at a MySQL server, failing only at
  // execution time.
  const caps = dialectCapabilities(driver)
  const isPostgres = caps.wire === 'postgres'
  const isMysql = caps.wire === 'mysql'
  const isSqlite = caps.wire === 'sqlite'

  return {
    driver,
    isPostgres,
    isMysql,
    isSqlite,
    now: isPostgres || isMysql ? 'NOW()' : `datetime('now')`,
    boolTrue: isPostgres ? 'true' : '1',
    boolFalse: isPostgres ? 'false' : '0',
    autoIncrement: isPostgres ? 'SERIAL' : 'INTEGER',
    // A dialect without server-side auto-increment gets a plain primary key
    // and nothing else. Emitting AUTO_INCREMENT on a sharded engine is not a
    // syntax error — it is worse, because each shard would independently
    // hand out the same values and collide. The key has to come from a
    // sequence in an unsharded keyspace or from the application
    // (`useUuid`), so the DDL says only that the column is the key.
    primaryKey: !caps.supportsAutoIncrement
      ? 'PRIMARY KEY'
      : isPostgres
          ? 'PRIMARY KEY'
          : isMysql
            ? 'PRIMARY KEY AUTO_INCREMENT'
            : 'PRIMARY KEY AUTOINCREMENT',
    pkColumn: !caps.supportsAutoIncrement
      ? 'id BIGINT NOT NULL PRIMARY KEY'
      : isPostgres
          ? 'id SERIAL PRIMARY KEY'
          : isMysql
            ? 'id INTEGER PRIMARY KEY AUTO_INCREMENT'
            : 'id INTEGER PRIMARY KEY AUTOINCREMENT',
    datetime: isMysql ? 'DATETIME' : 'TIMESTAMP',
    nullableTimestamp: isMysql ? 'DATETIME NULL' : 'TIMESTAMP',

    param(index: number): string {
      return isPostgres ? `$${index}` : '?'
    },

    params(...values: unknown[]): { sql: string, values: unknown[] } {
      if (isPostgres) {
        const placeholders = values.map((_, i) => `$${i + 1}`).join(', ')
        return { sql: placeholders, values }
      }
      const placeholders = values.map(() => '?').join(', ')
      return { sql: placeholders, values }
    },
  }
}
