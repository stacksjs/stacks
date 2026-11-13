import type { QueryBuilderDialect } from './dialect'
import { sqlHelpers } from './sql-helpers'
import { db, getDatabaseDialect } from './utils'

/**
 * Whether a table exists, asked of the database's own catalog.
 *
 * For telling "this table has not been migrated" apart from every other
 * failure. Matching error text cannot do that reliably: "does not exist" is
 * PostgreSQL's wording for a missing column as well as a missing table, and
 * each driver words it differently. The catalog answers the question directly.
 *
 * PostgreSQL resolves the name through `search_path`, as an unqualified query
 * against the table would. The MySQL-wire dialects look in the current
 * database, and SQLite in `sqlite_master`. The name is always a bound value.
 */
export interface TableCatalogRunner {
  unsafe: (sql: string, values?: unknown[]) => { execute: () => Promise<unknown> }
}

export function tableExistsSql(dialect: QueryBuilderDialect): string {
  const param = sqlHelpers(dialect).param(1)

  if (dialect === 'postgres')
    return `SELECT 1 AS present WHERE to_regclass(quote_ident(${param})) IS NOT NULL`

  if (dialect === 'sqlite')
    return `SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = ${param}`

  return `SELECT 1 AS present FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ${param}`
}

/** `runner` and `dialect` default to the configured `db` and its dialect. */
export async function tableExists(table: string, runner: TableCatalogRunner = db, dialect: QueryBuilderDialect = getDatabaseDialect()): Promise<boolean> {
  const rows = await runner.unsafe(tableExistsSql(dialect), [table]).execute()
  return Array.isArray(rows) && rows.length > 0
}
