import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'

interface SyncInput {
  userIds?: unknown
}

/**
 * `POST /api/dashboard/kanban/cards/:id/assignees` (stacksjs/stacks#1846 Phase 3).
 *
 * Replaces the set of users assigned to a card. Sync semantics —
 * pass the new full list of user ids, the action diffs against
 * what's currently attached.
 *
 * Stamps `assigned_by_user_id` on each new pivot row from the
 * request's authenticated user (when available) so the card detail
 * modal can surface "assigned by X" attribution. Unauthenticated
 * dev-dashboard calls leave it null.
 *
 * Cross-validation: each user id must exist. Doesn't validate
 * board-scoped membership — kanban users aren't (currently) team-
 * scoped; any platform user can be assigned to any card. Phase 4
 * could tighten this if board-membership becomes a concept.
 */
export default new Action({
  name: 'Kanban Card Assignees Sync',
  description: 'Replaces the set of users assigned to a card.',
  method: 'POST',
  apiResponse: true,
  async handle(request) {
    const rawId = (request as any)?.params?.id ?? (request as any)?.param?.('id') ?? null
    const cardId = Number(rawId)
    if (!Number.isFinite(cardId) || cardId <= 0)
      return { error: 'Invalid card id', status: 400 }

    const body = (request as any).jsonBody as SyncInput | undefined ?? {}
    if (!Array.isArray(body.userIds))
      return { error: '`userIds` must be an array of user ids (possibly empty).', status: 400 }

    const userIds: number[] = []
    for (const v of body.userIds) {
      const n = Number(v)
      if (!Number.isFinite(n) || n <= 0)
        return { error: '`userIds` contains an invalid id.', status: 400 }
      userIds.push(n)
    }
    const uniqueUserIds = Array.from(new Set(userIds))

    try {
      const cardRows = await db.unsafe('SELECT id FROM cards WHERE id = ? LIMIT 1', [cardId]).execute() as Array<{ id: number }>
      if (!cardRows?.length)
        return { error: 'Card not found.', status: 404 }

      // Validate user ids exist.
      if (uniqueUserIds.length > 0) {
        const placeholders = uniqueUserIds.map(() => '?').join(',')
        const userRows = await db.unsafe(
          `SELECT id FROM users WHERE id IN (${placeholders})`,
          uniqueUserIds,
        ).execute() as Array<{ id: number }>
        if (userRows.length !== uniqueUserIds.length)
          return { error: 'One or more user ids do not exist.', status: 400 }
      }

      const requester = (request as any).user ?? (request as any)._authenticatedUser ?? null
      const assignedByUserId = requester && typeof requester.id === 'number' ? requester.id : null

      const txOps = async (qb: any) => {
        await qb.deleteFrom('card_assignees').where('card_id', '=', cardId).execute()
        if (uniqueUserIds.length > 0) {
          const rows = uniqueUserIds.map(userId => ({
            card_id: cardId,
            user_id: userId,
            assigned_by_user_id: assignedByUserId,
          }))
          await qb.insertInto('card_assignees').values(rows).execute()
        }
      }
      try {
        await (db as any).transaction(txOps)
      }
      catch {
        await txOps(db)
      }

      // Return the resolved user rows for the optimistic UI to confirm.
      let assignees: Array<{ userId: number, name: string | null, email: string | null }> = []
      if (uniqueUserIds.length > 0) {
        const placeholders = uniqueUserIds.map(() => '?').join(',')
        const rows = await db.unsafe(
          `SELECT id, name, email FROM users WHERE id IN (${placeholders}) ORDER BY name ASC`,
          uniqueUserIds,
        ).execute() as Array<{ id: number, name: string | null, email: string | null }>
        assignees = rows.map(r => ({ userId: r.id, name: r.name, email: r.email }))
      }
      return { cardId, assignees }
    }
    catch (err) {
      console.error('[dashboard/kanban] CardAssigneesSyncAction failed:', err)
      return { error: err instanceof Error ? err.message : 'unknown error', status: 500 }
    }
  },
})
