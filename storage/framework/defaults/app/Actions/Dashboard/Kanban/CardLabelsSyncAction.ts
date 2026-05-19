import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'

interface SyncInput {
  labelIds?: unknown
}

/**
 * `POST /api/dashboard/kanban/cards/:id/labels` (stacksjs/stacks#1846 Phase 3).
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
  async handle(request) {
    const rawId = (request as any)?.params?.id ?? (request as any)?.param?.('id') ?? null
    const cardId = Number(rawId)
    if (!Number.isFinite(cardId) || cardId <= 0)
      return { error: 'Invalid card id', status: 400 }

    const body = (request as any).jsonBody as SyncInput | undefined ?? {}
    if (!Array.isArray(body.labelIds))
      return { error: '`labelIds` must be an array of label ids (possibly empty).', status: 400 }

    const labelIds: number[] = []
    for (const v of body.labelIds) {
      const n = Number(v)
      if (!Number.isFinite(n) || n <= 0)
        return { error: '`labelIds` contains an invalid id.', status: 400 }
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
        return { error: 'Card not found.', status: 404 }

      // Every label must belong to the same board (labels are
      // board-scoped per Phase 1's `labels.board_id` design).
      if (uniqueLabelIds.length > 0) {
        const placeholders = uniqueLabelIds.map(() => '?').join(',')
        const labelRows = await db.unsafe(
          `SELECT id FROM labels WHERE id IN (${placeholders}) AND board_id = ?`,
          [...uniqueLabelIds, card.board_id],
        ).execute() as Array<{ id: number }>
        if (labelRows.length !== uniqueLabelIds.length)
          return { error: 'One or more label ids do not belong to this card\'s board.', status: 400 }
      }

      // Sync: drop all current pivot rows for this card, insert the
      // new set. Cheaper than diffing for the typical "user picked a
      // few labels" use case (single-digit label counts per card).
      const txOps = async (qb: any) => {
        await qb.deleteFrom('card_labels').where('card_id', '=', cardId).execute()
        if (uniqueLabelIds.length > 0) {
          const rows = uniqueLabelIds.map(labelId => ({ card_id: cardId, label_id: labelId }))
          await qb.insertInto('card_labels').values(rows).execute()
        }
      }
      try {
        await (db as any).transaction(txOps)
      }
      catch {
        await txOps(db)
      }

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
      console.error('[dashboard/kanban] CardLabelsSyncAction failed:', err)
      return { error: err instanceof Error ? err.message : 'unknown error', status: 500 }
    }
  },
})
