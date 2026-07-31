import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'
import { response } from '@stacksjs/router'
import { deliverTeamInvitation } from './team-invitation-delivery'
import {
  generateInvitationToken,
  hashInvitationToken,
  invitationExpiresAt,
  parsePositiveId,
  sqlTimestamp,
} from './team-records'

export default new Action({
  name: 'Dashboard Team Invitation Resend',
  description: 'Rotates and redelivers a pending or expired team invitation.',
  method: 'POST',
  apiResponse: true,

  async handle(request: RequestInstance) {
    const teamId = parsePositiveId(request.getParam('id'))
    const invitationId = parsePositiveId(request.getParam('invitationId'))
    if (!teamId || !invitationId)
      return response.json({ message: 'Invalid team or invitation id.' }, 400)

    const invitation = await (db as any)
      .selectFrom('team_invitations')
      .innerJoin('teams', 'teams.id', '=', 'team_invitations.team_id')
      .where('team_invitations.id', '=', invitationId)
      .where('team_invitations.team_id', '=', teamId)
      .select([
        'team_invitations.id as id',
        'team_invitations.email as email',
        'team_invitations.role as role',
        'team_invitations.status as status',
        'teams.name as team_name',
      ])
      .executeTakeFirst()
    if (!invitation)
      return response.json({ message: 'Invitation not found.' }, 404)
    if (!['pending', 'expired'].includes(String(invitation.status)))
      return response.json({ message: 'Only pending or expired invitations can be resent.' }, 409)

    const token = generateInvitationToken()
    const expiresAt = invitationExpiresAt()
    await (db as any)
      .updateTable('team_invitations')
      .set({
        token_hash: hashInvitationToken(token),
        status: 'pending',
        delivery_status: 'pending',
        delivery_error: null,
        expires_at: expiresAt,
        delivered_at: null,
        updated_at: sqlTimestamp(),
      })
      .where('id', '=', invitationId)
      .where('team_id', '=', teamId)
      .execute()

    try {
      await deliverTeamInvitation({
        id: invitationId,
        email: String(invitation.email),
        teamName: String(invitation.team_name),
        role: String(invitation.role),
        token,
      })
    }
    catch {
      return response.json({ message: 'The invitation was refreshed, but email delivery failed.' }, 502)
    }

    return {
      invitation: {
        id: invitationId,
        deliveryStatus: 'sent',
        expiresAt,
      },
    }
  },
})
