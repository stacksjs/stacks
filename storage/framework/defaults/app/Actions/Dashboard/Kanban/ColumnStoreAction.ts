import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'

interface ColumnInput {
  boardId?: unknown
  name?: unknown
  color?: unknown
  cardLimit?: unknown
}

/**
 * `POST /api/dashboard/kanban/columns` (stacksjs/stacks#1846 Phase 2).
 *
 * Appends a new column to the end of the target board. Validates that
 * `boardId` points at a real board so a typo doesn't silently create
 * an orphan column row.
 */
export default new Action({
  name: 'Kanban Column Store',
  description: 'Creates a new column on a board.',
  method: 'POST',
  apiResponse: true,
  async handle(request) {
    const body = (request as any).jsonBody as ColumnInput | undefined ?? {}

    const boardId = Number(body.boardId)
    if (!Number.isFinite(boardId) || boardId <= 0) {
      return { error: '`boardId` is required and must be a positive integer.', status: 400 }
    }
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name || name.length > 80) {
      return { error: '`name` is required and must be 1-80 characters.', status: 400 }
    }
    const color = typeof body.color === 'string' && body.color ? body.color : 'slate'
    const cardLimit = body.cardLimit == null
      ? null
      : (Number.isFinite(Number(body.cardLimit)) && Number(body.cardLimit) >= 0
          ? Number(body.cardLimit)
          : null)

    try {
      // Reject orphan columns up front — a column on a deleted board
      // would never surface in any sidebar or API, just rot in the DB.
      const boards = await db.unsafe('SELECT id FROM boards WHERE id = ? LIMIT 1', [boardId]).execute() as Array<{ id: number }>
      if (!boards?.length) {
        return { error: 'Board not found.', status: 404 }
      }

      const maxRow = await db.unsafe(
        'SELECT COALESCE(MAX(position), -1) AS m FROM board_columns WHERE board_id = ?',
        [boardId],
      ).execute() as Array<{ m: number }>
      const nextPosition = (Number(maxRow?.[0]?.m ?? -1) + 1) || 0

      await db.insertInto('board_columns').values({
        board_id: boardId,
        name,
        color,
        card_limit: cardLimit,
        position: nextPosition,
      }).execute()

      const rows = await db.unsafe(
        `SELECT id, uuid, board_id, name, position, card_limit, color, created_at, updated_at
        FROM board_columns
        WHERE board_id = ? AND name = ? AND position = ?
        ORDER BY id DESC
        LIMIT 1`,
        [boardId, name, nextPosition],
      ).execute() as Array<Record<string, unknown>>
      const r = rows?.[0]
      if (!r) {
        return { error: 'Column insert succeeded but follow-up read returned nothing.', status: 500 }
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
          cards: [],
        },
      }
    }
    catch (err) {
      console.error('[dashboard/kanban] ColumnStoreAction failed:', err)
      return { error: err instanceof Error ? err.message : 'unknown error', status: 500 }
    }
  },
})
