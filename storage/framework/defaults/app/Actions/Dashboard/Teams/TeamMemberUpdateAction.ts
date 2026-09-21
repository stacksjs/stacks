import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { db, getDatabaseDialect, sqlHelpers } from '@stacksjs/database/runtime'
import { response } from '@stacksjs/router'
import { teamOperationalError } from '../../Teams/team-response'
import { syncTeamMemberCount } from './team-member-count'
import { normalizeInvitationRole, parsePositiveId, sqlTimestamp } from './team-records'

interface UpdateInput {
  role?: unknown
  status?: unknown
}

export default new Action({
  name: 'Dashboard Team Member Update',
  description: 'Updates a non-owner team member role or status.',
  method: 'PATCH',
  apiResponse: true,

  async handle(request: RequestInstance<UpdateInput>) {
    const teamId = parsePositiveId(request.getParam('id'))
    const memberId = parsePositiveId(request.getParam('memberId'))
    if (!teamId || !memberId)
      return response.json({ message: 'Invalid team or member id.' }, 400)

    const input = request.all()
    try {
      return await db.transaction(async (rawTrx) => {
        const trx = rawTrx as unknown as typeof db
        /*
         * Lock the member for the rest of this transaction, then decide.
         *
         * This used to read the row unlocked and let the UPDATE's own
         * `role != 'owner'` predicate catch a concurrent ownership transfer,
         * treating an affected-row count other than 1 as "changed underneath
         * us" and answering 409. That count cannot carry the decision: MySQL
         * reports rows CHANGED, not rows MATCHED, so saving a member with the
         * role and status they already have reported 0, and a double submit
         * or any save in the same second as their last write (`sqlTimestamp`
         * has second precision) came back 409 "The team member changed before
         * they could be updated" for a member nobody had touched
         * (stacksjs/stacks#2639).
         *
         * With the row locked, nothing can change it between this read and
         * the write, so the checks below are made against the state the write
         * will actually land on, and the count is not needed at all. A
         * concurrent ownership transfer now waits for this transaction and
         * then applies, instead of racing it. Measured on PostgreSQL 16 and
         * MySQL 8.4.5: unlocked, a second connection made the member an owner
         * mid-transaction; locked, it hit its lock timeout.
         *
         * SQLite has no `FOR UPDATE` and does not need one: a writer that
         * commits after this read makes the UPDATE below fail when it tries to
         * upgrade the transaction, so nothing is silently overwritten there
         * either. auth/src/tokens.ts takes the same lock the same way.
         */
        let lookup = trx
          .selectFrom('team_members')
          .where('id', '=', memberId)
          .where('team_id', '=', teamId)
          .select(['id', 'role', 'status'])
        if (!sqlHelpers(getDatabaseDialect()).isSqlite)
          lookup = lookup.lockForUpdate()
        const member = await lookup.executeTakeFirst()
        if (!member)
          return response.json({ message: 'Team member not found.' }, 404)
        if (member.role === 'owner')
          return response.json({ message: 'Transfer team ownership before changing the owner.' }, 409)

        const role = input.role === undefined ? String(member.role) : normalizeInvitationRole(input.role)
        const status = input.status === undefined ? String(member.status) : String(input.status).trim().toLowerCase()
        if (!role)
          return response.json({ message: 'Choose a valid member role.' }, 422)
        if (!['active', 'suspended'].includes(status))
          return response.json({ message: 'Choose a valid member status.' }, 422)

        // The owner predicate stays as a second line of defence; under the
        // lock it always matches, which is why its count is not read.
        await trx
          .updateTable('team_members')
          .set({ role, status, updated_at: sqlTimestamp() })
          .where('id', '=', memberId)
          .where('team_id', '=', teamId)
          .where('role', '!=', 'owner')
          .execute()

        await syncTeamMemberCount(teamId, trx)
        return { member: { id: memberId, role, status } }
      })
    }
    catch (error) {
      return teamOperationalError(error, 'The team member could not be updated.', 'TeamMemberUpdateAction', 500)
    }
  },
})
