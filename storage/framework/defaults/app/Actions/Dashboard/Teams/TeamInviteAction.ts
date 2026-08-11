import type { RequestInstance } from '@stacksjs/types'
import { randomUUID } from 'node:crypto'
import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'
import { isUniqueViolation } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import { TeamStateConflictError, teamOperationalError } from '../../Teams/team-response'
import { deliverTeamInvitation } from './team-invitation-delivery'
import {
  changedRows,
  generateInvitationToken,
  hashInvitationToken,
  invitationExpiresAt,
  normalizeInvitationEmail,
  normalizeInvitationRole,
  parsePositiveId,
  sqlTimestamp,
} from './team-records'

interface InviteInput {
  email?: unknown
  role?: unknown
}

export default new Action({
  name: 'Dashboard Team Invite',
  description: 'Creates and delivers a single-use team invitation.',
  method: 'POST',
  apiResponse: true,

  async handle(request: RequestInstance<InviteInput>) {
    const teamId = parsePositiveId(request.getParam('id'))
    if (!teamId)
      return response.json({ message: 'Invalid team id.' }, 400)

    const input = request.all()
    const email = normalizeInvitationEmail(input.email)
    const role = normalizeInvitationRole(input.role ?? 'member')
    if (!email)
      return response.json({ message: 'Enter a valid email address.' }, 422)
    if (!role)
      return response.json({ message: 'Choose a valid invitation role.' }, 422)

    const token = generateInvitationToken()
    const tokenHash = hashInvitationToken(token)
    const pendingKey = `${teamId}:${email}`
    const expiresAt = invitationExpiresAt()
    let created: { id: number, teamName: string } | Response
    try {
      const requester = await request.user()
      const requesterId = Number(requester?.id)
      const invitedByUserId = Number.isSafeInteger(requesterId) && requesterId > 0
        ? requesterId
        : null

      created = await db.transaction(async (rawTrx) => {
        const trx = rawTrx as unknown as typeof db
        const team = await trx
          .selectFrom('teams')
          .where('id', '=', teamId)
          .select(['id', 'name'])
          .executeTakeFirst()
        if (!team)
          return response.json({ message: 'Team not found.' }, 404)

        const [existingUser, pending] = await Promise.all([
          trx
            .selectFrom('users')
            .where('email', '=', email)
            .select(['id'])
            .executeTakeFirst(),
          (trx as any)
            .selectFrom('team_invitations')
            .where('team_id', '=', teamId)
            .where('email', '=', email)
            .where('status', '=', 'pending')
            .select(['id', 'expires_at', 'token_hash'])
            .executeTakeFirst(),
        ])
        if (existingUser) {
          const membership = await (trx as any)
            .selectFrom('team_members')
            .where('team_id', '=', teamId)
            .where('user_id', '=', Number(existingUser.id))
            .select(['id'])
            .executeTakeFirst()
          if (membership)
            return response.json({ message: 'This person is already a member of the team.' }, 409)
        }

        if (pending && new Date(String(pending.expires_at).replace(' ', 'T')).getTime() > Date.now()) {
          return response.json({ message: 'A pending invitation already exists. Resend or revoke it from the invitation list.' }, 409)
        }
        if (pending) {
          const expired = await (trx as any)
            .updateTable('team_invitations')
            .set({ status: 'expired', pending_key: null, updated_at: sqlTimestamp() })
            .where('id', '=', Number(pending.id))
            .where('token_hash', '=', String(pending.token_hash))
            .where('status', '=', 'pending')
            .executeTakeFirst()
          if (changedRows(expired) !== 1)
            throw new TeamStateConflictError('The pending invitation changed before it could be replaced.')
        }

        await (trx as any)
          .insertInto('team_invitations')
          .values({
            team_id: teamId,
            email,
            role,
            token_hash: tokenHash,
            pending_key: pendingKey,
            invited_by_user_id: invitedByUserId,
            status: 'pending',
            delivery_status: 'pending',
            expires_at: expiresAt,
            uuid: randomUUID(),
          })
          .execute()

        const invitation = await (trx as any)
          .selectFrom('team_invitations')
          .where('token_hash', '=', tokenHash)
          .select(['id'])
          .executeTakeFirst()
        if (!invitation)
          throw new Error('The inserted invitation could not be resolved by its token hash.')

        return { id: Number(invitation.id), teamName: String(team.name) }
      })
    }
    catch (error) {
      if (error instanceof TeamStateConflictError)
        return response.json({ message: error.message }, 409)
      if (isUniqueViolation(error))
        return response.json({ message: 'A pending invitation already exists. Resend or revoke it from the invitation list.' }, 409)
      return teamOperationalError(error, 'The invitation could not be created.', 'TeamInviteAction.create', 500)
    }

    if (created instanceof Response)
      return created

    try {
      await deliverTeamInvitation({
        id: created.id,
        email,
        teamName: created.teamName,
        role,
        token,
        tokenHash,
      })
    }
    catch (error) {
      return teamOperationalError(error, 'Invitation created, but email delivery failed. You can retry it from the invitation list.', 'TeamInviteAction.delivery', 502)
    }

    return response.json({
      invitation: {
        id: created.id,
        email,
        role,
        status: 'pending',
        deliveryStatus: 'sent',
        expiresAt,
      },
    }, 201)
  },
})
