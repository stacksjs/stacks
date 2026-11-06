import type { QueryBuilderDialect } from '@stacksjs/database/runtime'
import type { QueryReader } from '../Content/content-list'
import type { NamedRow, NamedSearchQuery, NamedSearchRunner } from '../named-search'
import { NAMED_SEARCH_LIMIT, NAMED_SEARCH_MAX_LIMIT, parseNamedSearchQuery, searchNamedRows } from '../named-search'

/**
 * The users the card dialog's assignee picker offers.
 *
 * It used to load the first 500 users by name, once, with no search: in an app
 * with more, everyone past the 500th could not be assigned, and nothing said
 * so (stacksjs/stacks#3216). Now the picker asks the database through the
 * shared name and email search (`named-search.ts`).
 */
export const KANBAN_USER_LIMIT = NAMED_SEARCH_LIMIT
export const KANBAN_USER_MAX_LIMIT = NAMED_SEARCH_MAX_LIMIT

export type KanbanUserQuery = NamedSearchQuery
export type KanbanUser = NamedRow
export type KanbanUserRunner = NamedSearchRunner

export function parseKanbanUserQuery(read: QueryReader): KanbanUserQuery | { error: string } {
  return parseNamedSearchQuery(read)
}

export async function readKanbanUsers(
  query: KanbanUserQuery,
  runner?: KanbanUserRunner,
  dialect?: QueryBuilderDialect,
): Promise<{ users: KanbanUser[], total: number }> {
  const { rows, total } = await searchNamedRows('users', query, runner, dialect)
  return { users: rows, total }
}
