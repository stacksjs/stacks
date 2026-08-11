import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'
import { response } from '@stacksjs/router'
import { TeamStateConflictError, teamOperationalError } from '../../Teams/team-response'
import { syncTeamMemberCount } from './team-member-count'
import { changedRows, normalizeInvitationRole, parsePositiveId, sqlTimestamp } from './team-records'

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
        const member = await (trx as any)
          .selectFrom('team_members')
          .where('id', '=', memberId)
          .where('team_id', '=', teamId)
          .select(['id', 'role', 'status'])
          .executeTakeFirst()
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

        const updated = await (trx as any)
          .updateTable('team_members')
          .set({ role, status, updated_at: sqlTimestamp() })
          .where('id', '=', memberId)
          .where('team_id', '=', teamId)
          .where('role', '!=', 'owner')
          .executeTakeFirst()
        if (changedRows(updated) !== 1)
          throw new TeamStateConflictError('The team member changed before they could be updated.')

        await syncTeamMemberCount(teamId, trx)
        return { member: { id: memberId, role, status } }
      })
    }
    catch (error) {
      if (error instanceof TeamStateConflictError)
        return response.json({ message: error.message }, 409)
      return teamOperationalError(error, 'The team member could not be updated.', 'TeamMemberUpdateAction', 500)
    }
  },
})
