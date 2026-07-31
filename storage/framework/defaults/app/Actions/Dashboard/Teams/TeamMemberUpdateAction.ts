import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'
import { response } from '@stacksjs/router'
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

  async handle(request: RequestInstance) {
    const teamId = parsePositiveId(request.getParam('id'))
    const memberId = parsePositiveId(request.getParam('memberId'))
    if (!teamId || !memberId)
      return response.json({ message: 'Invalid team or member id.' }, 400)

    const member = await (db as any)
      .selectFrom('team_members')
      .where('id', '=', memberId)
      .where('team_id', '=', teamId)
      .select(['id', 'role', 'status'])
      .executeTakeFirst()
    if (!member)
      return response.json({ message: 'Team member not found.' }, 404)
    if (member.role === 'owner')
      return response.json({ message: 'Transfer team ownership before changing the owner.' }, 409)

    const input = (request as any).jsonBody as UpdateInput | undefined ?? {}
    const role = input.role === undefined ? String(member.role) : normalizeInvitationRole(input.role)
    const status = input.status === undefined ? String(member.status) : String(input.status).trim().toLowerCase()
    if (!role)
      return response.json({ message: 'Choose a valid member role.' }, 422)
    if (!['active', 'suspended'].includes(status))
      return response.json({ message: 'Choose a valid member status.' }, 422)

    await (db as any)
      .updateTable('team_members')
      .set({ role, status, updated_at: sqlTimestamp() })
      .where('id', '=', memberId)
      .where('team_id', '=', teamId)
      .execute()

    await syncTeamMemberCount(teamId)

    return { member: { id: memberId, role, status } }
  },
})
