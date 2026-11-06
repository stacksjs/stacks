import type { QueryBuilderDialect } from '@stacksjs/database/runtime'
import { db, getDatabaseDialect, sqlHelpers } from '@stacksjs/database/runtime'
import type { QueryReader } from './Content/content-list'
import { containsPattern, countOf, queryText } from './Content/content-list'

/**
 * A search over a table's `name` and `email`, for the dashboard's pickers: the
 * Kanban assignee picker (users, stacksjs/stacks#3216) and the order dialog's
 * customer (customers, stacksjs/stacks#3218). Each used to load the first 500
 * rows once, so nobody past the 500th could be chosen.
 *
 * Case is ignored on both columns, `%` and `_` are characters to find, the
 * answer is bounded, and `total` says how many matched.
 */
export const NAMED_SEARCH_TABLES = ['users', 'customers'] as const
export type NamedSearchTable = typeof NAMED_SEARCH_TABLES[number]

export const NAMED_SEARCH_LIMIT = 25
export const NAMED_SEARCH_MAX_LIMIT = 100

export interface NamedSearchQuery {
  search: string
  limit: number
}

export interface NamedRow {
  id: number
  name: string | null
  email: string | null
}

/** What runs the two queries: the configured `db`, or a test's own connection. */
export interface NamedSearchRunner {
  unsafe: (sql: string, values?: unknown[]) => { execute: () => Promise<unknown> }
}

export function parseNamedSearchQuery(read: QueryReader): NamedSearchQuery | { error: string } {
  const search = queryText(read, 'q')
  if (search.length > 200)
    return { error: 'q must be 200 characters or fewer.' }

  const limitText = queryText(read, 'limit')
  const limit = limitText === '' ? NAMED_SEARCH_LIMIT : Number(limitText)
  if (!Number.isInteger(limit) || limit < 1 || limit > NAMED_SEARCH_MAX_LIMIT)
    return { error: `limit must be a whole number from 1 to ${NAMED_SEARCH_MAX_LIMIT}.` }

  return { search, limit }
}

export async function searchNamedRows(
  table: NamedSearchTable,
  query: NamedSearchQuery,
  runner: NamedSearchRunner = db,
  dialect: QueryBuilderDialect = getDatabaseDialect(),
): Promise<{ rows: NamedRow[], total: number }> {
  // The table name is SQL, not a value, so only the fixed list is accepted.
  if (!(NAMED_SEARCH_TABLES as readonly string[]).includes(table))
    throw new TypeError(`${table} is not a searchable table.`)

  const sql = sqlHelpers(dialect)
  const values: unknown[] = []
  let where = ''
  if (query.search) {
    const pattern = containsPattern(query.search)
    values.push(pattern, pattern)
    where = ` WHERE LOWER(COALESCE(name, '')) LIKE ${sql.param(1)} ESCAPE '!' OR LOWER(COALESCE(email, '')) LIKE ${sql.param(2)} ESCAPE '!'`
  }

  const counted = await runner.unsafe(`SELECT COUNT(*) AS total_count FROM ${table}${where}`, values).execute() as Array<{ total_count: unknown }>
  const found = await runner.unsafe(
    `SELECT id, name, email FROM ${table}${where} ORDER BY name ASC, id ASC LIMIT ${query.limit}`,
    values,
  ).execute() as Array<{ id: unknown, name: string | null, email: string | null }>

  return {
    rows: (Array.isArray(found) ? found : []).map(row => ({ id: Number(row.id), name: row.name ?? null, email: row.email ?? null })),
    total: countOf(Array.isArray(counted) ? counted[0]?.total_count : 0),
  }
}
