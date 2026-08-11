import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'
import { response } from '@stacksjs/router'
import { TeamStateConflictError, teamOperationalError } from '../../Teams/team-response'
import { syncTeamMemberCount } from './team-member-count'
import { changedRows, parsePositiveId } from './team-records'

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

    let result: Response | null
    try {
      result = await db.transaction(async (rawTrx) => {
        const trx = rawTrx as unknown as typeof db
        const member = await (trx as any)
          .selectFrom('team_members')
          .where('id', '=', memberId)
          .where('team_id', '=', teamId)
          .select(['id', 'role'])
          .executeTakeFirst()
        if (!member)
          return response.json({ message: 'Team member not found.' }, 404)
        if (member.role === 'owner')
          return response.json({ message: 'Transfer team ownership before removing the owner.' }, 409)

        const deleted = await (trx as any)
          .deleteFrom('team_members')
          .where('id', '=', memberId)
          .where('team_id', '=', teamId)
          .where('role', '!=', 'owner')
          .executeTakeFirst()
        if (changedRows(deleted) !== 1)
          throw new TeamStateConflictError('The team member changed before they could be removed.')

        await syncTeamMemberCount(teamId, trx)
        return null
      })
    }
    catch (error) {
      if (error instanceof TeamStateConflictError)
        return response.json({ message: error.message }, 409)
      return teamOperationalError(error, 'The team member could not be removed.', 'TeamMemberDestroyAction', 500)
    }

    if (result)
      return result

    return response.noContent()
  },
})
