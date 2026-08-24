import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'
import { modelBoolean } from './kanban-model'
import { kanbanActionError } from './kanban-response'

interface BoardRow {
  id: number
  uuid: string | null
  name: string
  description: string | null
  icon: string
  color: string
  position: number
  // SQLite stores booleans as 0/1 INTEGER columns; Postgres returns real booleans.
  archived: number | boolean
  created_at: string | null
  updated_at: string | null
  card_count?: number
}

/**
 * `GET /api/dashboard/kanban/boards`
 *
 * Lists every non-archived board with a fast card-count sub-query so
 * the index page can show "5 cards" badges without a second round-trip
 * per board. Cards table is joined in aggregate, not row-by-row, so
 * the response stays single-query (N+1 free).
 *
 * Auth: gated by the `auth` + `role:admin,dev` middleware on the route
 * group (boards are a dev-mode surface per #1843). The action body
 * doesn't re-check the role; the middleware did.
 *
 * Mutations use the sibling store, update, destroy, and reorder actions.
 */
export default new Action({
  name: 'Kanban Boards Index',
  description: 'Lists kanban boards with per-board card counts for the dashboard index page.',
  method: 'GET',
  apiResponse: true,
  async handle() {
    try {
      // The card_count is computed via a correlated sub-select rather
      // than a JOIN + GROUP BY so the row shape stays flat. Empty
      // boards return `card_count: 0` instead of being dropped (which
      // is what an inner join + group-by would do).
      const rows = await db.unsafe(`
        SELECT
          b.id, b.uuid, b.name, b.description, b.icon, b.color,
          b.position, b.archived, b.created_at, b.updated_at,
          (SELECT COUNT(*) FROM cards c WHERE c.board_id = b.id AND c.archived = false) AS card_count
        FROM boards b
        WHERE b.archived = false
        ORDER BY b.position ASC, b.id ASC
      `).execute() as unknown as BoardRow[]

      const boards = (rows ?? []).map(r => ({
        id: r.id,
        uuid: r.uuid,
        name: r.name,
        description: r.description,
        icon: r.icon,
        color: r.color,
        position: r.position,
        archived: modelBoolean(r, 'archived'),
        cardCount: Number(r.card_count ?? 0),
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }))

      return { boards }
    }
    catch (err) {
      return kanbanActionError(err, 'BoardsIndexAction')
    }
  },
})
