import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'
import { response } from '@stacksjs/router'
import { teamOperationalError } from '../../Teams/team-response'
import {
  changedRows,
  generateInvitationToken,
  hashInvitationToken,
  parsePositiveId,
  sqlTimestamp,
} from './team-records'

export default new Action({
  name: 'Dashboard Team Invitation Destroy',
  description: 'Revokes a pending team invitation.',
  method: 'DELETE',
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
        .where('id', '=', invitationId)
        .where('team_id', '=', teamId)
        .select(['id', 'status', 'token_hash'])
        .executeTakeFirst()
    }
    catch (error) {
      return teamOperationalError(error, 'Invitation could not be loaded.', 'TeamInvitationDestroyAction.lookup', 500)
    }
    if (!invitation)
      return response.json({ message: 'Invitation not found.' }, 404)
    if (invitation.status !== 'pending')
      return response.json({ message: 'Only pending invitations can be revoked.' }, 409)

    try {
      const result = await (db as any)
        .updateTable('team_invitations')
        .set({
          status: 'revoked',
          token_hash: hashInvitationToken(generateInvitationToken()),
          pending_key: null,
          updated_at: sqlTimestamp(),
        })
        .where('id', '=', invitationId)
        .where('team_id', '=', teamId)
        .where('token_hash', '=', String(invitation.token_hash))
        .where('status', '=', 'pending')
        .executeTakeFirst()
      if (changedRows(result) !== 1)
        return response.json({ message: 'The invitation changed before it could be revoked.' }, 409)
    }
    catch (error) {
      return teamOperationalError(error, 'Invitation could not be revoked.', 'TeamInvitationDestroyAction.update', 500)
    }

    return response.noContent()
  },
})
