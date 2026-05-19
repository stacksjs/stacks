import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'

interface BoardRow {
  id: number
  uuid: string | null
  name: string
  description: string | null
  icon: string
  color: string
  position: number
  archived: number
  created_at: string | null
  updated_at: string | null
}

interface ColumnRow {
  id: number
  uuid: string | null
  board_id: number
  name: string
  position: number
  card_limit: number | null
  color: string
  created_at: string | null
  updated_at: string | null
}

interface CardRow {
  id: number
  uuid: string | null
  column_id: number
  board_id: number
  title: string
  description: string | null
  position: number
  created_by_user_id: number | null
  due_date: string | null
  archived: number
  created_at: string | null
  updated_at: string | null
}

interface LabelRow {
  id: number
  board_id: number
  name: string
  color: string
}

/**
 * `GET /api/dashboard/kanban/boards/:id`
 *
 * Returns a single board with its columns + cards + label palette
 * nested in render order. Powers the kanban board page
 * (`/kanban/[id]`) — Phase 2 hits this on mount, the drag handler
 * then mutates positions via the (Phase 2) reorder endpoint and
 * relies on optimistic updates for snappy UX.
 *
 * Query layout (3 queries, all indexed):
 *   1. Single-row board lookup by id.
 *   2. All columns for the board (ordered by `position`).
 *   3. All non-archived cards for the board (ordered by
 *      `column_id, position`).
 *   4. All labels for the board.
 *
 * Card-label pivot reads land in Phase 3 alongside the card detail
 * modal — the board view shows label chips inline, hydrated from a
 * single pivot query batched with the card fetch.
 */
export default new Action({
  name: 'Kanban Board Show',
  description: 'Returns a single kanban board with its columns + cards + label palette.',
  method: 'GET',
  apiResponse: true,
  async handle(request) {
    // Route param resolution: bun-router exposes `:id` via
    // `request.param('id')` / `request.params.id`. Both shapes appear
    // in this codebase depending on how the route was registered;
    // covering both keeps the action portable.
    const rawId = (request as any)?.params?.id
      ?? (request as any)?.param?.('id')
      ?? null
    const id = Number(rawId)
    if (!Number.isFinite(id) || id <= 0) {
      return { error: 'Invalid board id', status: 400 }
    }

    try {
      const boards = await db.unsafe(
        'SELECT * FROM boards WHERE id = ? LIMIT 1',
        [id],
      ).execute() as BoardRow[]
      const board = boards[0]
      if (!board) {
        return { error: 'Board not found', status: 404 }
      }

      const [columns, cards, labels] = await Promise.all([
        db.unsafe(
          'SELECT * FROM board_columns WHERE board_id = ? ORDER BY position ASC, id ASC',
          [id],
        ).execute() as Promise<ColumnRow[]>,
        db.unsafe(
          'SELECT * FROM cards WHERE board_id = ? AND archived = 0 ORDER BY column_id ASC, position ASC, id ASC',
          [id],
        ).execute() as Promise<CardRow[]>,
        db.unsafe(
          'SELECT id, board_id, name, color FROM labels WHERE board_id = ? ORDER BY name ASC',
          [id],
        ).execute() as Promise<LabelRow[]>,
      ])

      // Pivot lookups for label + assignee chips on card previews
      // (stacksjs/stacks#1846 Phase 3). Two batched JOINs keyed off the
      // board's card list — single round-trip per pivot, then group
      // client-side into `cardId → list` maps.
      const [cardLabelRows, cardAssigneeRows] = await Promise.all([
        db.unsafe(
          `SELECT cl.card_id, l.id, l.name, l.color
          FROM card_labels cl
          JOIN labels l ON l.id = cl.label_id
          WHERE cl.card_id IN (SELECT id FROM cards WHERE board_id = ? AND archived = 0)
          ORDER BY l.name ASC`,
          [id],
        ).execute() as Promise<Array<{ card_id: number, id: number, name: string, color: string }>>,
        db.unsafe(
          `SELECT ca.card_id, ca.user_id, u.name, u.email
          FROM card_assignees ca
          LEFT JOIN users u ON u.id = ca.user_id
          WHERE ca.card_id IN (SELECT id FROM cards WHERE board_id = ? AND archived = 0)`,
          [id],
        ).execute() as Promise<Array<{ card_id: number, user_id: number, name: string | null, email: string | null }>>,
      ])

      const labelsByCard = new Map<number, Array<{ id: number, name: string, color: string }>>()
      for (const r of cardLabelRows ?? []) {
        const list = labelsByCard.get(r.card_id) ?? []
        list.push({ id: r.id, name: r.name, color: r.color })
        labelsByCard.set(r.card_id, list)
      }
      const assigneesByCard = new Map<number, Array<{ userId: number, name: string | null, email: string | null }>>()
      for (const r of cardAssigneeRows ?? []) {
        const list = assigneesByCard.get(r.card_id) ?? []
        list.push({ userId: r.user_id, name: r.name, email: r.email })
        assigneesByCard.set(r.card_id, list)
      }

      // Group cards by column id so the page renders columns directly
      // from `columns[].cards` without doing the grouping client-side.
      // Empty columns get an empty array, not undefined.
      const cardsByColumn = new Map<number, CardRow[]>()
      for (const c of cards ?? []) {
        const list = cardsByColumn.get(c.column_id) ?? []
        list.push(c)
        cardsByColumn.set(c.column_id, list)
      }

      const responseColumns = (columns ?? []).map(col => ({
        id: col.id,
        uuid: col.uuid,
        boardId: col.board_id,
        name: col.name,
        position: col.position,
        cardLimit: col.card_limit,
        color: col.color,
        cards: (cardsByColumn.get(col.id) ?? []).map(c => ({
          id: c.id,
          uuid: c.uuid,
          columnId: c.column_id,
          boardId: c.board_id,
          title: c.title,
          description: c.description,
          position: c.position,
          createdByUserId: c.created_by_user_id,
          dueDate: c.due_date,
          archived: c.archived === 1,
          createdAt: c.created_at,
          updatedAt: c.updated_at,
          labels: labelsByCard.get(c.id) ?? [],
          assignees: assigneesByCard.get(c.id) ?? [],
        })),
      }))

      return {
        board: {
          id: board.id,
          uuid: board.uuid,
          name: board.name,
          description: board.description,
          icon: board.icon,
          color: board.color,
          position: board.position,
          archived: board.archived === 1,
          createdAt: board.created_at,
          updatedAt: board.updated_at,
        },
        columns: responseColumns,
        labels: (labels ?? []).map(l => ({
          id: l.id,
          boardId: l.board_id,
          name: l.name,
          color: l.color,
        })),
      }
    }
    catch (err) {
      console.error('[dashboard/kanban] BoardShowAction failed:', err)
      return {
        error: err instanceof Error ? err.message : 'unknown error',
        status: 500,
      }
    }
  },
})
