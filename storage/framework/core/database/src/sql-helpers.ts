/**
 * SQL Dialect Helpers
 *
 * Cross-database compatibility utilities for PostgreSQL, MySQL, and SQLite.
 * Centralizes the isPostgres/isMysql/now/boolTrue/boolFalse/param helpers
 * that were previously duplicated across tokens.ts, auth-tables.ts, and setup.ts.
 */

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
  const isPostgres = driver === 'postgres'
  const isMysql = driver === 'mysql'
  const isSqlite = !isPostgres && !isMysql

  return {
    driver,
    isPostgres,
    isMysql,
    isSqlite,
    now: isPostgres || isMysql ? 'NOW()' : `datetime('now')`,
    boolTrue: isPostgres ? 'true' : '1',
    boolFalse: isPostgres ? 'false' : '0',
    autoIncrement: isPostgres ? 'SERIAL' : 'INTEGER',
    primaryKey: isPostgres
      ? 'PRIMARY KEY'
      : isMysql
        ? 'PRIMARY KEY AUTO_INCREMENT'
        : 'PRIMARY KEY AUTOINCREMENT',

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
