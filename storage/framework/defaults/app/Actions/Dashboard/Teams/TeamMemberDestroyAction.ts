import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'
import { response } from '@stacksjs/router'
import { syncTeamMemberCount } from './team-member-count'
import { parsePositiveId } from './team-records'

export default new Action({
  name: 'Dashboard Team Member Destroy',
  description: 'Removes a non-owner member from a team.',
  method: 'DELETE',
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
      .select(['id', 'role'])
      .executeTakeFirst()
    if (!member)
      return response.json({ message: 'Team member not found.' }, 404)
    if (member.role === 'owner')
      return response.json({ message: 'Transfer team ownership before removing the owner.' }, 409)

    await (db as any)
      .deleteFrom('team_members')
      .where('id', '=', memberId)
      .where('team_id', '=', teamId)
      .execute()

    await syncTeamMemberCount(teamId)

    return response.noContent()
  },
})
