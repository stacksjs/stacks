import type { QueryBuilderDialect } from '@stacksjs/database/runtime'
import { sqlHelpers } from '@stacksjs/database/runtime'

/**
 * The SQL plumbing the commerce lists share (stacksjs/stacks#3218): Orders and
 * Payments read their pages with plain SQL so one test can run them against
 * SQLite, PostgreSQL and MySQL alike.
 */

/** What runs the queries: the configured `db`, or a test's own connection. */
export interface CommerceSqlRunner {
  unsafe: (sql: string, values?: unknown[]) => { execute: () => unknown }
}

/** A result as rows, whatever the driver returned for an empty one. */
export function sqlRows(result: unknown): Array<Record<string, unknown>> {
  return Array.isArray(result) ? result as Array<Record<string, unknown>> : []
}

/** The placeholders for an `IN (...)` over `ids`, numbered from 1. */
export function idPlaceholders(ids: unknown[], dialect: QueryBuilderDialect): string {
  const sql = sqlHelpers(dialect)
  return ids.map((_, index) => sql.param(index + 1)).join(', ')
}

/**
 * A column as text, for `LOWER`, `LIKE` and comparisons. PostgreSQL enums
 * (payments.status and payments.method) and numbers need it, and comparing an
 * enum to a value it does not list is an error there rather than no match.
 */
export function asText(column: string, dialect: QueryBuilderDialect): string {
  const type = dialect === 'mysql' || dialect === 'singlestore' || dialect === 'vitess' ? 'CHAR' : 'TEXT'
  return `CAST(${column} AS ${type})`
}

/** Binds values in order and returns each placeholder, for building a WHERE. */
export function binder(dialect: QueryBuilderDialect): { bind: (value: unknown) => string, values: unknown[] } {
  const sql = sqlHelpers(dialect)
  const values: unknown[] = []
  return {
    values,
    bind: (value: unknown) => {
      values.push(value)
      return sql.param(values.length)
    },
  }
}

/**
 * "This flag is set", the same on every dialect: SQLite and MySQL store 0 and
 * 1, and PostgreSQL a boolean, or an integer in an older schema, which the
 * cast reads either way. A bare `column = 1` is an error on a PostgreSQL
 * boolean.
 */
export function isTrue(column: string, dialect: QueryBuilderDialect): string {
  return dialect === 'postgres' ? `CAST(${column} AS INTEGER) = 1` : `${column} = 1`
}
