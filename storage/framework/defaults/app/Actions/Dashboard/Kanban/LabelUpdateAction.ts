import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'

interface LabelInput {
  name?: unknown
  color?: unknown
}

/**
 * `PATCH /api/dashboard/kanban/labels/:id` (stacksjs/stacks#1846 Phase 3).
 *
 * Partial update for label name + color. `board_id` is not movable —
 * a label on board A renaming to "Bug" must not collide with a
 * pre-existing "Bug" label on board A (caught up front, rather than
 * letting the unique index fire its own error).
 */
export default new Action({
  name: 'Kanban Label Update',
  description: 'Partial update of a label name / color.',
  method: 'PATCH',
  apiResponse: true,
  async handle(request) {
    const rawId = (request as any)?.params?.id ?? (request as any)?.param?.('id') ?? null
    const id = Number(rawId)
    if (!Number.isFinite(id) || id <= 0) {
      return { error: 'Invalid label id', status: 400 }
    }

    const body = (request as any).jsonBody as LabelInput | undefined ?? {}
    const set: Record<string, unknown> = {}
    let renamingTo: string | null = null

    if (typeof body.name === 'string') {
      const name = body.name.trim()
      if (!name || name.length > 60) {
        return { error: '`name` must be 1-60 characters.', status: 400 }
      }
      set.name = name
      renamingTo = name
    }
    if (typeof body.color === 'string' && body.color)
      set.color = body.color

    if (Object.keys(set).length === 0)
      return { error: 'No updatable fields provided.', status: 400 }

    try {
      // Fetch current label to know which board to check for the
      // rename collision.
      const existing = await db.unsafe(
        'SELECT id, board_id, name FROM labels WHERE id = ? LIMIT 1',
        [id],
      ).execute() as Array<{ id: number, board_id: number, name: string }>
      const current = existing?.[0]
      if (!current)
        return { error: 'Label not found', status: 404 }

      if (renamingTo && renamingTo !== current.name) {
        const dup = await db.unsafe(
          'SELECT id FROM labels WHERE board_id = ? AND name = ? AND id != ? LIMIT 1',
          [current.board_id, renamingTo, id],
        ).execute() as Array<{ id: number }>
        if (dup?.length)
          return { error: 'A label with that name already exists on this board.', status: 409 }
      }

      await db.updateTable('labels').set(set as any).where('id', '=', id).execute()

      const rows = await db.unsafe(
        'SELECT id, board_id, name, color FROM labels WHERE id = ? LIMIT 1',
        [id],
      ).execute() as Array<{ id: number, board_id: number, name: string, color: string }>
      const r = rows?.[0]
      if (!r)
        return { error: 'Label not found', status: 404 }
      return { label: { id: r.id, boardId: r.board_id, name: r.name, color: r.color } }
    }
    catch (err) {
      console.error('[dashboard/kanban] LabelUpdateAction failed:', err)
      return { error: err instanceof Error ? err.message : 'unknown error', status: 500 }
    }
  },
})
