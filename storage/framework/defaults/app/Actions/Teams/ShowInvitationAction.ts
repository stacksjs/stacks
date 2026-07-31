import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'
import { response } from '@stacksjs/router'
import { hashInvitationToken, invitationStatus } from '../Dashboard/Teams/team-records'

export default new Action({
  name: 'Show Team Invitation',
  description: 'Returns the public details needed to accept a bearer-token invitation.',
  method: 'GET',
  apiResponse: true,

  async handle(request: RequestInstance) {
    const token = String(request.getParam('token') || '')
    if (!token || token.length > 200)
      return response.json({ message: 'Invitation not found.' }, 404)

    const invitation = await (db as any)
      .selectFrom('team_invitations')
      .innerJoin('teams', 'teams.id', '=', 'team_invitations.team_id')
      .where('team_invitations.token_hash', '=', hashInvitationToken(token))
      .select([
        'team_invitations.id as id',
        'team_invitations.team_id as team_id',
        'team_invitations.email as email',
        'team_invitations.role as role',
        'team_invitations.status as status',
        'team_invitations.expires_at as expires_at',
        'teams.name as team_name',
      ])
      .executeTakeFirst()
    if (!invitation)
      return response.json({ message: 'Invitation not found.' }, 404)

    return {
      invitation: {
        teamId: Number(invitation.team_id),
        teamName: String(invitation.team_name),
        email: String(invitation.email),
        role: String(invitation.role),
        status: invitationStatus(invitation.status, invitation.expires_at),
        expiresAt: String(invitation.expires_at),
      },
    }
  },
})
