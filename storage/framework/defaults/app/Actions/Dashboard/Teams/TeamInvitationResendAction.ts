import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'
import { isUniqueViolation } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import { teamOperationalError } from '../../Teams/team-response'
import { deliverTeamInvitation } from './team-invitation-delivery'
import {
  changedRows,
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

    let invitation
    try {
      invitation = await (db as any)
        .selectFrom('team_invitations')
        .innerJoin('teams', 'teams.id', '=', 'team_invitations.team_id')
        .where('team_invitations.id', '=', invitationId)
        .where('team_invitations.team_id', '=', teamId)
        .select([
          'team_invitations.id as id',
          'team_invitations.email as email',
          'team_invitations.role as role',
          'team_invitations.status as status',
          'team_invitations.token_hash as token_hash',
          'teams.name as team_name',
        ])
        .executeTakeFirst()
    }
    catch (error) {
      return teamOperationalError(error, 'Invitation could not be loaded.', 'TeamInvitationResendAction.lookup', 500)
    }
    if (!invitation)
      return response.json({ message: 'Invitation not found.' }, 404)
    if (!['pending', 'expired'].includes(String(invitation.status)))
      return response.json({ message: 'Only pending or expired invitations can be resent.' }, 409)

    const token = generateInvitationToken()
    const tokenHash = hashInvitationToken(token)
    const expiresAt = invitationExpiresAt()
    try {
      const result = await (db as any)
        .updateTable('team_invitations')
        .set({
          token_hash: tokenHash,
          pending_key: `${teamId}:${String(invitation.email).trim().toLowerCase()}`,
          status: 'pending',
          delivery_status: 'pending',
          delivery_error: null,
          expires_at: expiresAt,
          delivered_at: null,
          updated_at: sqlTimestamp(),
        })
        .where('id', '=', invitationId)
        .where('team_id', '=', teamId)
        .where('token_hash', '=', String(invitation.token_hash))
        .executeTakeFirst()
      if (changedRows(result) !== 1)
        return response.json({ message: 'The invitation changed before it could be resent.' }, 409)
    }
    catch (error) {
      if (isUniqueViolation(error))
        return response.json({ message: 'Another pending invitation already exists for this email.' }, 409)
      return teamOperationalError(error, 'Invitation could not be refreshed.', 'TeamInvitationResendAction.update', 500)
    }

    try {
      await deliverTeamInvitation({
        id: invitationId,
        email: String(invitation.email),
        teamName: String(invitation.team_name),
        role: String(invitation.role),
        token,
        tokenHash,
      })
    }
    catch (error) {
      return teamOperationalError(error, 'The invitation was refreshed, but email delivery failed.', 'TeamInvitationResendAction.delivery', 502)
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
