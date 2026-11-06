import type { QueryBuilderDialect } from '@stacksjs/database/runtime'
import { db, getDatabaseDialect, sqlHelpers } from '@stacksjs/database/runtime'
import type { QueryReader } from '../Content/content-list'
import { countOf, queryText } from '../Content/content-list'

/**
 * The users the card dialog's assignee picker offers.
 *
 * It used to load the first 500 users by name, once, with no search: in an app
 * with more, everyone past the 500th could not be assigned, and nothing said
 * so (stacksjs/stacks#3216). Now the picker asks the database: a search over
 * name and email that ignores case, a bounded number of matches, and how many
 * matched, so the dialog can say when to narrow the search.
 */
export const KANBAN_USER_LIMIT = 25
export const KANBAN_USER_MAX_LIMIT = 100

export interface KanbanUserQuery {
  search: string
  limit: number
}

/** What runs the two queries: the configured `db`, or a test's own connection. */
export interface KanbanUserRunner {
  unsafe: (sql: string, values?: unknown[]) => { execute: () => Promise<unknown> }
}

export interface KanbanUser {
  id: number
  name: string | null
  email: string | null
}

export function parseKanbanUserQuery(read: QueryReader): KanbanUserQuery | { error: string } {
  const search = queryText(read, 'q')
  if (search.length > 200)
    return { error: 'q must be 200 characters or fewer.' }

  const limitText = queryText(read, 'limit')
  const limit = limitText === '' ? KANBAN_USER_LIMIT : Number(limitText)
  if (!Number.isInteger(limit) || limit < 1 || limit > KANBAN_USER_MAX_LIMIT)
    return { error: `limit must be a whole number from 1 to ${KANBAN_USER_MAX_LIMIT}.` }

  return { search, limit }
}

/**
 * A `LIKE` pattern that matches `term` anywhere, with its own `%` and `_`
 * taken literally. `!` is the escape character because it means the same in
 * every dialect: SQLite has no default escape, and MySQL reads a backslash in
 * a string literal as an escape of its own.
 */
export function containsPattern(term: string): string {
  return `%${term.toLowerCase().replace(/[!%_]/g, character => `!${character}`)}%`
}

export async function readKanbanUsers(
  query: KanbanUserQuery,
  runner: KanbanUserRunner = db,
  dialect: QueryBuilderDialect = getDatabaseDialect(),
): Promise<{ users: KanbanUser[], total: number }> {
  const sql = sqlHelpers(dialect)
  const values: unknown[] = []
  let where = ''
  if (query.search) {
    const pattern = containsPattern(query.search)
    values.push(pattern, pattern)
    where = ` WHERE LOWER(COALESCE(name, '')) LIKE ${sql.param(1)} ESCAPE '!' OR LOWER(COALESCE(email, '')) LIKE ${sql.param(2)} ESCAPE '!'`
  }

  const counted = await runner.unsafe(`SELECT COUNT(*) AS total_count FROM users${where}`, values).execute() as Array<{ total_count: unknown }>
  const rows = await runner.unsafe(
    `SELECT id, name, email FROM users${where} ORDER BY name ASC, id ASC LIMIT ${query.limit}`,
    values,
  ).execute() as Array<{ id: unknown, name: string | null, email: string | null }>

  return {
    users: (Array.isArray(rows) ? rows : []).map(row => ({ id: Number(row.id), name: row.name ?? null, email: row.email ?? null })),
    total: countOf(Array.isArray(counted) ? counted[0]?.total_count : 0),
  }
}
