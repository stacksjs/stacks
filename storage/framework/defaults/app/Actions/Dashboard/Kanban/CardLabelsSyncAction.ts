import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'
import { kanbanActionError, kanbanError } from './kanban-response'

interface SyncInput {
  labelIds?: unknown
}

/**
 * `POST /api/dashboard/kanban/cards/:id/labels`.
 *
 * Replaces the set of labels attached to a card. Sync semantics —
 * pass the new full list of label ids, the action diffs against
 * what's currently attached and attaches/detaches to match.
 *
 * Cross-validation: every label in `labelIds` must belong to the
 * same board as the card. Stops a malformed page from cross-
 * contaminating two boards' label namespaces.
 *
 * Wrapped in a transaction so a partial failure leaves the card
 * with either the old set or the new set, never something in
 * between.
 */
export default new Action({
  name: 'Kanban Card Labels Sync',
  description: 'Replaces the set of labels attached to a card.',
  method: 'POST',
  apiResponse: true,
  async handle(request: RequestInstance<SyncInput>) {
    const cardId = Number(request.getParam('id'))
    if (!Number.isFinite(cardId) || cardId <= 0)
      return kanbanError('Invalid card id', 400)

    const body = request.all()
    if (!Array.isArray(body.labelIds))
      return kanbanError('`labelIds` must be an array of label ids (possibly empty).', 400)

    const labelIds: number[] = []
    for (const v of body.labelIds) {
      const n = Number(v)
      if (!Number.isFinite(n) || n <= 0)
        return kanbanError('`labelIds` contains an invalid id.', 400)
      labelIds.push(n)
    }
    const uniqueLabelIds = Array.from(new Set(labelIds))

    try {
      // Resolve the card → board so we can validate label scope.
      const cardRows = await db.unsafe(
        'SELECT id, board_id FROM cards WHERE id = ? LIMIT 1',
        [cardId],
      ).execute() as Array<{ id: number, board_id: number }>
      const card = cardRows?.[0]
      if (!card)
        return kanbanError('Card not found.', 404)

      // Every label must belong to the same board (labels are
      // board-scoped through `labels.board_id`).
      if (uniqueLabelIds.length > 0) {
        const placeholders = uniqueLabelIds.map(() => '?').join(',')
        const labelRows = await db.unsafe(
          `SELECT id FROM labels WHERE id IN (${placeholders}) AND board_id = ?`,
          [...uniqueLabelIds, card.board_id],
        ).execute() as Array<{ id: number }>
        if (labelRows.length !== uniqueLabelIds.length)
          return kanbanError('One or more label ids do not belong to this card\'s board.', 400)
      }

      // Sync: drop all current pivot rows for this card, insert the
      // new set. Cheaper than diffing for the typical "user picked a
      // few labels" use case (single-digit label counts per card).
      await db.transaction(async (rawTrx) => {
        const qb = rawTrx as unknown as typeof db
        await qb.deleteFrom('card_labels').where('card_id', '=', cardId).execute()
        if (uniqueLabelIds.length > 0) {
          const rows = uniqueLabelIds.map(labelId => ({ card_id: cardId, label_id: labelId }))
          await qb.insertInto('card_labels').values(rows).execute()
        }
      })

      // Return the resolved label rows so the optimistic UI can
      // confirm its in-flight state matches what the server stored.
      let labels: Array<{ id: number, name: string, color: string }> = []
      if (uniqueLabelIds.length > 0) {
        const placeholders = uniqueLabelIds.map(() => '?').join(',')
        labels = await db.unsafe(
          `SELECT id, name, color FROM labels WHERE id IN (${placeholders}) ORDER BY name ASC`,
          uniqueLabelIds,
        ).execute() as Array<{ id: number, name: string, color: string }>
      }
      return { cardId, labels }
    }
    catch (err) {
      return kanbanActionError(err, 'CardLabelsSyncAction')
    }
  },
})
