import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'

interface CardInput {
  columnId?: unknown
  title?: unknown
  description?: unknown
  dueDate?: unknown
}

/**
 * `POST /api/dashboard/kanban/cards` (stacksjs/stacks#1846 Phase 2).
 *
 * Creates a card at the end of the target column. `boardId` is
 * resolved server-side from `column.board_id` (denormalised onto the
 * card row) so clients don't pass it in — passing it from the page
 * would invite drift if the column was moved between boards (which
 * isn't a feature, but still).
 *
 * Stamps `created_by_user_id` from `request.user` when the request is
 * authenticated; leaves it null for the no-auth dev dashboard so the
 * surface still works on localhost.
 */
export default new Action({
  name: 'Kanban Card Store',
  description: 'Creates a new card in a column.',
  method: 'POST',
  apiResponse: true,
  async handle(request) {
    const body = (request as any).jsonBody as CardInput | undefined ?? {}

    const columnId = Number(body.columnId)
    if (!Number.isFinite(columnId) || columnId <= 0) {
      return { error: '`columnId` is required and must be a positive integer.', status: 400 }
    }
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    if (!title || title.length > 300) {
      return { error: '`title` is required and must be 1-300 characters.', status: 400 }
    }
    const description = typeof body.description === 'string' ? body.description.trim() : null
    const dueDate = typeof body.dueDate === 'string' && body.dueDate ? body.dueDate : null

    try {
      // Resolve the column → board_id so we can denormalise. Same trip
      // also validates that the column exists; an orphan column id
      // rejects up front rather than inserting a card with a dangling
      // FK that no query would ever surface.
      const cols = await db.unsafe(
        'SELECT id, board_id FROM board_columns WHERE id = ? LIMIT 1',
        [columnId],
      ).execute() as Array<{ id: number, board_id: number }>
      const col = cols?.[0]
      if (!col) {
        return { error: 'Column not found.', status: 404 }
      }

      const maxRow = await db.unsafe(
        'SELECT COALESCE(MAX(position), -1) AS m FROM cards WHERE column_id = ?',
        [columnId],
      ).execute() as Array<{ m: number }>
      const nextPosition = (Number(maxRow?.[0]?.m ?? -1) + 1) || 0

      const user = (request as any).user ?? (request as any)._authenticatedUser ?? null
      const createdByUserId = user && typeof user.id === 'number' ? user.id : null

      await db.insertInto('cards').values({
        column_id: columnId,
        board_id: col.board_id,
        title,
        description,
        position: nextPosition,
        created_by_user_id: createdByUserId,
        due_date: dueDate,
        archived: 0,
      }).execute()

      const rows = await db.unsafe(
        `SELECT id, uuid, column_id, board_id, title, description, position,
                created_by_user_id, due_date, archived, created_at, updated_at
        FROM cards
        WHERE column_id = ? AND title = ? AND position = ?
        ORDER BY id DESC LIMIT 1`,
        [columnId, title, nextPosition],
      ).execute() as Array<Record<string, unknown>>
      const r = rows?.[0]
      if (!r) {
        return { error: 'Card insert succeeded but follow-up read returned nothing.', status: 500 }
      }

      return {
        card: {
          id: Number(r.id),
          uuid: r.uuid == null ? null : String(r.uuid),
          columnId: Number(r.column_id),
          boardId: Number(r.board_id),
          title: String(r.title),
          description: r.description == null ? null : String(r.description),
          position: Number(r.position),
          createdByUserId: r.created_by_user_id == null ? null : Number(r.created_by_user_id),
          dueDate: r.due_date == null ? null : String(r.due_date),
          archived: Number(r.archived) === 1,
          createdAt: r.created_at == null ? null : String(r.created_at),
          updatedAt: r.updated_at == null ? null : String(r.updated_at),
        },
      }
    }
    catch (err) {
      console.error('[dashboard/kanban] CardStoreAction failed:', err)
      return { error: err instanceof Error ? err.message : 'unknown error', status: 500 }
    }
  },
})
