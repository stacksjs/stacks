import type { RequestInstance } from '@stacksjs/types'
import { randomUUID } from 'node:crypto'
import { Action } from '@stacksjs/actions'
import { resolveAuthenticatedUser } from '@stacksjs/auth'
import { db } from '@stacksjs/database'
import { response } from '@stacksjs/router'
import {
  changedRows,
  generateInvitationToken,
  hashInvitationToken,
  invitationStatus,
  normalizeInvitationEmail,
  sqlTimestamp,
} from '../Dashboard/Teams/team-records'
import { syncTeamMemberCount } from '../Dashboard/Teams/team-member-count'

export default new Action({
  name: 'Accept Team Invitation',
  description: 'Accepts a team invitation for its authenticated email recipient.',
  method: 'POST',
  apiResponse: true,

  async handle(request: RequestInstance) {
    const token = String(request.getParam('token') || '')
    if (!token || token.length > 200)
      return response.json({ message: 'Invitation not found.' }, 404)

    const authenticated = await resolveAuthenticatedUser(request as any)
    if (!authenticated?.id)
      return response.json({ message: 'Sign in to accept this invitation.' }, 401)

    const user = await db
      .selectFrom('users')
      .where('id', '=', authenticated.id)
      .select(['id', 'email'])
      .executeTakeFirst()
    if (!user)
      return response.json({ message: 'Authenticated user not found.' }, 401)

    const invitation = await (db as any)
      .selectFrom('team_invitations')
      .where('token_hash', '=', hashInvitationToken(token))
      .select(['id', 'team_id', 'email', 'role', 'status', 'expires_at'])
      .executeTakeFirst()
    if (!invitation)
      return response.json({ message: 'Invitation not found.' }, 404)

    const status = invitationStatus(invitation.status, invitation.expires_at)
    if (status !== 'pending')
      return response.json({ message: status === 'expired' ? 'This invitation has expired.' : 'This invitation is no longer available.' }, 409)

    const invitedEmail = normalizeInvitationEmail(invitation.email)
    const userEmail = normalizeInvitationEmail(user.email)
    if (!invitedEmail || invitedEmail !== userEmail)
      return response.json({ message: 'Sign in with the email address that received this invitation.' }, 403)

    const teamId = Number(invitation.team_id)
    const userId = Number(user.id)
    const now = sqlTimestamp()

    const accepted = await db.transaction(async (rawTrx) => {
      const trx = rawTrx as unknown as typeof db
      const claim = await (trx as any)
        .updateTable('team_invitations')
        .set({
          status: 'accepted',
          token_hash: hashInvitationToken(generateInvitationToken()),
          accepted_by_user_id: userId,
          accepted_at: now,
          updated_at: now,
        })
        .where('id', '=', Number(invitation.id))
        .where('token_hash', '=', hashInvitationToken(token))
        .where('status', '=', 'pending')
        .executeTakeFirst()

      if (changedRows(claim) !== 1)
        return null

      const existing = await (trx as any)
        .selectFrom('team_members')
        .where('team_id', '=', teamId)
        .where('user_id', '=', userId)
        .select(['id'])
        .executeTakeFirst()

      if (!existing) {
        await (trx as any)
          .insertInto('team_members')
          .values({
            team_id: teamId,
            user_id: userId,
            role: String(invitation.role),
            status: 'active',
            created_at: now,
            uuid: randomUUID(),
          })
          .execute()
      }

      await syncTeamMemberCount(teamId, trx)
      return { alreadyMember: Boolean(existing) }
    })

    if (!accepted)
      return response.json({ message: 'This invitation is no longer available.' }, 409)

    return {
      accepted: true,
      alreadyMember: accepted.alreadyMember,
      teamId,
    }
  },
})
