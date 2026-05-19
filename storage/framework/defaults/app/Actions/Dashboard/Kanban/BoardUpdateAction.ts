import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'

interface BoardInput {
  name?: unknown
  description?: unknown
  icon?: unknown
  color?: unknown
  archived?: unknown
}

/**
 * `PATCH /api/dashboard/kanban/boards/:id` (stacksjs/stacks#1846 Phase 2).
 *
 * Partial update — only the fields present in the body are written.
 * Omitting `archived` does NOT change the archive flag; passing
 * `archived: true` soft-archives the board (it drops out of the
 * /boards index but stays queryable at `/boards/:id`).
 *
 * `position` is intentionally NOT updatable here — bulk reordering
 * goes through `/boards/reorder` so the page can rewrite multiple
 * rows in one round-trip and avoid the gaps that single-row updates
 * leave behind. Position-via-PATCH would invite the "drag a card,
 * then the sibling row's position is wrong" footgun.
 */
export default new Action({
  name: 'Kanban Board Update',
  description: 'Partial update of a kanban board.',
  method: 'PATCH',
  apiResponse: true,
  async handle(request) {
    const rawId = (request as any)?.params?.id ?? (request as any)?.param?.('id') ?? null
    const id = Number(rawId)
    if (!Number.isFinite(id) || id <= 0) {
      return { error: 'Invalid board id', status: 400 }
    }

    const body = (request as any).jsonBody as BoardInput | undefined ?? {}
    const set: Record<string, unknown> = {}

    if (typeof body.name === 'string') {
      const name = body.name.trim()
      if (!name || name.length > 120) {
        return { error: 'Name must be 1-120 characters.', status: 400 }
      }
      set.name = name
    }
    if (typeof body.description === 'string' || body.description === null) {
      set.description = typeof body.description === 'string' ? body.description.trim() : null
    }
    if (typeof body.icon === 'string' && body.icon)
      set.icon = body.icon
    if (typeof body.color === 'string' && body.color)
      set.color = body.color
    if (typeof body.archived === 'boolean')
      set.archived = body.archived ? 1 : 0

    if (Object.keys(set).length === 0) {
      return { error: 'No updatable fields provided.', status: 400 }
    }

    try {
      // The `db.updateTable` chain works across dialects; we accumulate
      // the partial set above and apply it in one statement.
      await db.updateTable('boards').set(set as any).where('id', '=', id).execute()

      const rows = await db.unsafe(
        `SELECT id, uuid, name, description, icon, color, position, archived, created_at, updated_at
        FROM boards WHERE id = ? LIMIT 1`,
        [id],
      ).execute() as Array<Record<string, unknown>>
      const r = rows?.[0]
      if (!r) {
        return { error: 'Board not found', status: 404 }
      }
      return {
        board: {
          id: Number(r.id),
          uuid: r.uuid == null ? null : String(r.uuid),
          name: String(r.name),
          description: r.description == null ? null : String(r.description),
          icon: String(r.icon),
          color: String(r.color),
          position: Number(r.position),
          archived: Number(r.archived) === 1,
          createdAt: r.created_at == null ? null : String(r.created_at),
          updatedAt: r.updated_at == null ? null : String(r.updated_at),
        },
      }
    }
    catch (err) {
      console.error('[dashboard/kanban] BoardUpdateAction failed:', err)
      return { error: err instanceof Error ? err.message : 'unknown error', status: 500 }
    }
  },
})
