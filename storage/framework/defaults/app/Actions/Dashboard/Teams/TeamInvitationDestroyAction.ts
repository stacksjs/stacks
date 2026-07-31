import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'
import { response } from '@stacksjs/router'
import {
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

    const invitation = await (db as any)
      .selectFrom('team_invitations')
      .where('id', '=', invitationId)
      .where('team_id', '=', teamId)
      .select(['id', 'status'])
      .executeTakeFirst()
    if (!invitation)
      return response.json({ message: 'Invitation not found.' }, 404)
    if (invitation.status !== 'pending')
      return response.json({ message: 'Only pending invitations can be revoked.' }, 409)

    await (db as any)
      .updateTable('team_invitations')
      .set({
        status: 'revoked',
        token_hash: hashInvitationToken(generateInvitationToken()),
        updated_at: sqlTimestamp(),
      })
      .where('id', '=', invitationId)
      .where('team_id', '=', teamId)
      .execute()

    return response.noContent()
  },
})
