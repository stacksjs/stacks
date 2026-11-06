import type { ResponseStatus } from '@stacksjs/bun-router'
import { response } from '@stacksjs/router'
import { isUnmigratedTable } from '../Models/model-migration'

export function kanbanError(error: string, status: ResponseStatus): Response {
  return response.json({ error }, status)
}

/**
 * Every table a Kanban board reads or writes. All of them are the dashboard
 * feature's, so one `./buddy migrate` creates the lot. `card_labels` and
 * `card_assignees` are pivots with no model of their own.
 */
export const KANBAN_TABLES = [
  'boards',
  'board_columns',
  'cards',
  'labels',
  'card_labels',
  'card_assignees',
  'card_comments',
  'card_attachments',
  'feedback_tokens',
] as const

/** The Kanban tables the catalog says are missing, in `KANBAN_TABLES` order. */
export async function missingKanbanTables(isMissing: (table: string) => Promise<boolean> = isUnmigratedTable): Promise<string[]> {
  const missing: string[] = []
  for (const table of KANBAN_TABLES) {
    if (await isMissing(table))
      missing.push(table)
  }
  return missing
}

export function kanbanNotMigratedMessage(tables: string[]): string {
  const list = tables.length === 1 ? `the ${tables[0]} table does not` : `the ${tables.slice(0, -1).join(', ')} and ${tables.at(-1)} tables do not`
  return `Kanban is not set up yet: ${list} exist. Run ./buddy migrate to create them.`
}

/**
 * The response for a Kanban action that failed.
 *
 * Asked only after a failure: if the catalog reports Kanban tables missing, the
 * answer names them and the command, with status 503, because nothing is wrong
 * that a migration does not fix. A board could be created and then neither
 * opened nor deleted, each saying only "could not be completed"
 * (stacksjs/stacks#3217). Any other failure, including a catalog check that
 * fails too, is logged and answered with the generic 500, so an outage is never
 * relabelled as a migrate hint and no database error text reaches the page.
 */
export async function kanbanActionError(
  error: unknown,
  action: string,
  missing: () => Promise<string[]> = missingKanbanTables,
): Promise<Response> {
  const tables = await missing()
  if (tables.length > 0)
    return response.json({ error: kanbanNotMigratedMessage(tables), missingTables: tables }, 503)

  console.error(`[dashboard/kanban] ${action} failed:`, error)
  return kanbanError('The Kanban request could not be completed.', 500)
}
