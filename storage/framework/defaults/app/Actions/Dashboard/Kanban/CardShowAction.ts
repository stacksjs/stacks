import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'

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

/**
 * `GET /api/dashboard/kanban/cards/:id` (stacksjs/stacks#1846 Phase 3).
 *
 * Fetches a single card with everything the detail modal needs in one
 * round-trip: labels, assignees, comments. The board view's cards
 * already carry labels + assignees (BoardShowAction batches the
 * pivots) — this endpoint is for the case where the user lands
 * directly on a card URL or refreshes mid-modal.
 *
 * Three queries via `Promise.all`:
 *   1. The card itself.
 *   2. Labels via the card_labels pivot (with the label row).
 *   3. Assignees via the card_assignees pivot (with user.name/email).
 *   4. Comments (denormalised user name/email for display).
 */
export default new Action({
  name: 'Kanban Card Show',
  description: 'Returns a single card with its labels, assignees, and comments thread.',
  method: 'GET',
  apiResponse: true,
  async handle(request) {
    const rawId = (request as any)?.params?.id ?? (request as any)?.param?.('id') ?? null
    const id = Number(rawId)
    if (!Number.isFinite(id) || id <= 0) {
      return { error: 'Invalid card id', status: 400 }
    }

    try {
      const cardRows = await db.unsafe(
        'SELECT * FROM cards WHERE id = ? LIMIT 1',
        [id],
      ).execute() as CardRow[]
      const card = cardRows?.[0]
      if (!card) {
        return { error: 'Card not found', status: 404 }
      }

      const [labels, assignees, comments] = await Promise.all([
        db.unsafe(
          `SELECT l.id, l.name, l.color
          FROM card_labels cl
          JOIN labels l ON l.id = cl.label_id
          WHERE cl.card_id = ?
          ORDER BY l.name ASC`,
          [id],
        ).execute() as Promise<Array<{ id: number, name: string, color: string }>>,
        db.unsafe(
          `SELECT ca.user_id, ca.assigned_by_user_id, ca.created_at, u.name, u.email
          FROM card_assignees ca
          LEFT JOIN users u ON u.id = ca.user_id
          WHERE ca.card_id = ?`,
          [id],
        ).execute() as Promise<Array<{ user_id: number, assigned_by_user_id: number | null, created_at: string | null, name: string | null, email: string | null }>>,
        db.unsafe(
          `SELECT cc.id, cc.uuid, cc.user_id, cc.body, cc.created_at, cc.updated_at, u.name, u.email
          FROM card_comments cc
          LEFT JOIN users u ON u.id = cc.user_id
          WHERE cc.card_id = ?
          ORDER BY cc.created_at ASC, cc.id ASC`,
          [id],
        ).execute() as Promise<Array<{ id: number, uuid: string | null, user_id: number | null, body: string, created_at: string | null, updated_at: string | null, name: string | null, email: string | null }>>,
      ])

      return {
        card: {
          id: card.id,
          uuid: card.uuid,
          columnId: card.column_id,
          boardId: card.board_id,
          title: card.title,
          description: card.description,
          position: card.position,
          createdByUserId: card.created_by_user_id,
          dueDate: card.due_date,
          archived: card.archived === 1,
          createdAt: card.created_at,
          updatedAt: card.updated_at,
        },
        labels: (labels ?? []).map(l => ({ id: l.id, name: l.name, color: l.color })),
        assignees: (assignees ?? []).map(a => ({
          userId: a.user_id,
          name: a.name,
          email: a.email,
          assignedByUserId: a.assigned_by_user_id,
          assignedAt: a.created_at,
        })),
        comments: (comments ?? []).map(c => ({
          id: c.id,
          uuid: c.uuid,
          userId: c.user_id,
          body: c.body,
          authorName: c.name,
          authorEmail: c.email,
          createdAt: c.created_at,
          updatedAt: c.updated_at,
        })),
      }
    }
    catch (err) {
      console.error('[dashboard/kanban] CardShowAction failed:', err)
      return { error: err instanceof Error ? err.message : 'unknown error', status: 500 }
    }
  },
})
