import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'

interface ColumnInput {
  name?: unknown
  color?: unknown
  cardLimit?: unknown
}

/**
 * `PATCH /api/dashboard/kanban/columns/:id` (stacksjs/stacks#1846 Phase 2).
 *
 * Partial update for name / color / card limit. `position` and
 * `boardId` are NOT updatable here — moving a column between boards
 * isn't a feature (would orphan its cards' denormalised `board_id`);
 * reordering goes through `/columns/reorder` so transactions cover
 * the whole rewrite.
 */
export default new Action({
  name: 'Kanban Column Update',
  description: 'Partial update of a board column.',
  method: 'PATCH',
  apiResponse: true,
  async handle(request) {
    const rawId = (request as any)?.params?.id ?? (request as any)?.param?.('id') ?? null
    const id = Number(rawId)
    if (!Number.isFinite(id) || id <= 0) {
      return { error: 'Invalid column id', status: 400 }
    }

    const body = (request as any).jsonBody as ColumnInput | undefined ?? {}
    const set: Record<string, unknown> = {}

    if (typeof body.name === 'string') {
      const name = body.name.trim()
      if (!name || name.length > 80) {
        return { error: '`name` must be 1-80 characters.', status: 400 }
      }
      set.name = name
    }
    if (typeof body.color === 'string' && body.color)
      set.color = body.color
    if (body.cardLimit !== undefined) {
      if (body.cardLimit === null) {
        set.card_limit = null
      }
      else {
        const n = Number(body.cardLimit)
        if (!Number.isFinite(n) || n < 0) {
          return { error: '`cardLimit` must be a non-negative number or null.', status: 400 }
        }
        set.card_limit = n
      }
    }

    if (Object.keys(set).length === 0) {
      return { error: 'No updatable fields provided.', status: 400 }
    }

    try {
      await db.updateTable('board_columns').set(set as any).where('id', '=', id).execute()

      const rows = await db.unsafe(
        `SELECT id, uuid, board_id, name, position, card_limit, color, created_at, updated_at
        FROM board_columns WHERE id = ? LIMIT 1`,
        [id],
      ).execute() as Array<Record<string, unknown>>
      const r = rows?.[0]
      if (!r) {
        return { error: 'Column not found', status: 404 }
      }
      return {
        column: {
          id: Number(r.id),
          uuid: r.uuid == null ? null : String(r.uuid),
          boardId: Number(r.board_id),
          name: String(r.name),
          position: Number(r.position),
          cardLimit: r.card_limit == null ? null : Number(r.card_limit),
          color: String(r.color),
        },
      }
    }
    catch (err) {
      console.error('[dashboard/kanban] ColumnUpdateAction failed:', err)
      return { error: err instanceof Error ? err.message : 'unknown error', status: 500 }
    }
  },
})
