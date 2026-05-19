import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'

interface CardInput {
  title?: unknown
  description?: unknown
  dueDate?: unknown
  archived?: unknown
}

/**
 * `PATCH /api/dashboard/kanban/cards/:id` (stacksjs/stacks#1846 Phase 2).
 *
 * Partial update for the card body: title, description, due date,
 * archive flag. `position` and `columnId` are NOT updatable here —
 * card moves go through `/cards/reorder` which can rewrite multiple
 * rows transactionally and keep the denormalised `board_id` in sync
 * when a card crosses columns on different boards (rare but possible
 * if the page reordered a column move pair).
 */
export default new Action({
  name: 'Kanban Card Update',
  description: 'Partial update of a card body (title, description, due date, archive).',
  method: 'PATCH',
  apiResponse: true,
  async handle(request) {
    const rawId = (request as any)?.params?.id ?? (request as any)?.param?.('id') ?? null
    const id = Number(rawId)
    if (!Number.isFinite(id) || id <= 0) {
      return { error: 'Invalid card id', status: 400 }
    }

    const body = (request as any).jsonBody as CardInput | undefined ?? {}
    const set: Record<string, unknown> = {}

    if (typeof body.title === 'string') {
      const title = body.title.trim()
      if (!title || title.length > 300) {
        return { error: '`title` must be 1-300 characters.', status: 400 }
      }
      set.title = title
    }
    if (typeof body.description === 'string' || body.description === null) {
      set.description = typeof body.description === 'string' ? body.description.trim() : null
    }
    if (typeof body.dueDate === 'string' || body.dueDate === null) {
      set.due_date = typeof body.dueDate === 'string' && body.dueDate ? body.dueDate : null
    }
    if (typeof body.archived === 'boolean')
      set.archived = body.archived ? 1 : 0

    if (Object.keys(set).length === 0) {
      return { error: 'No updatable fields provided.', status: 400 }
    }

    try {
      await db.updateTable('cards').set(set as any).where('id', '=', id).execute()

      const rows = await db.unsafe(
        `SELECT id, uuid, column_id, board_id, title, description, position,
                created_by_user_id, due_date, archived, created_at, updated_at
        FROM cards WHERE id = ? LIMIT 1`,
        [id],
      ).execute() as Array<Record<string, unknown>>
      const r = rows?.[0]
      if (!r) {
        return { error: 'Card not found', status: 404 }
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
      console.error('[dashboard/kanban] CardUpdateAction failed:', err)
      return { error: err instanceof Error ? err.message : 'unknown error', status: 500 }
    }
  },
})
