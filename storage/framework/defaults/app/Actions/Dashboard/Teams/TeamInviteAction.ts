import type { RequestInstance } from '@stacksjs/types'
import { randomUUID } from 'node:crypto'
import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'
import { response } from '@stacksjs/router'
import { deliverTeamInvitation } from './team-invitation-delivery'
import {
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

  async handle(request: RequestInstance) {
    const teamId = parsePositiveId(request.getParam('id'))
    if (!teamId)
      return response.json({ message: 'Invalid team id.' }, 400)

    const input = (request as any).jsonBody as InviteInput | undefined ?? {}
    const email = normalizeInvitationEmail(input.email)
    const role = normalizeInvitationRole(input.role ?? 'member')
    if (!email)
      return response.json({ message: 'Enter a valid email address.' }, 422)
    if (!role)
      return response.json({ message: 'Choose a valid invitation role.' }, 422)

    const team = await db
      .selectFrom('teams')
      .where('id', '=', teamId)
      .select(['id', 'name'])
      .executeTakeFirst()
    if (!team)
      return response.json({ message: 'Team not found.' }, 404)

    const existingUser = await db
      .selectFrom('users')
      .where('email', '=', email)
      .select(['id'])
      .executeTakeFirst()
    if (existingUser) {
      const membership = await (db as any)
        .selectFrom('team_members')
        .where('team_id', '=', teamId)
        .where('user_id', '=', Number(existingUser.id))
        .select(['id'])
        .executeTakeFirst()
      if (membership)
        return response.json({ message: 'This person is already a member of the team.' }, 409)
    }

    const pending = await (db as any)
      .selectFrom('team_invitations')
      .where('team_id', '=', teamId)
      .where('email', '=', email)
      .where('status', '=', 'pending')
      .select(['id', 'expires_at'])
      .executeTakeFirst()
    if (pending && new Date(String(pending.expires_at).replace(' ', 'T')).getTime() > Date.now()) {
      return response.json({ message: 'A pending invitation already exists. Resend or revoke it from the invitation list.' }, 409)
    }
    if (pending) {
      await (db as any)
        .updateTable('team_invitations')
        .set({ status: 'expired', updated_at: sqlTimestamp() })
        .where('id', '=', Number(pending.id))
        .execute()
    }

    const token = generateInvitationToken()
    const tokenHash = hashInvitationToken(token)
    const expiresAt = invitationExpiresAt()
    const requester = (request as any).user ?? (request as any)._authenticatedUser ?? null
    const invitedByUserId = requester && Number.isInteger(Number(requester.id))
      ? Number(requester.id)
      : null

    await (db as any)
      .insertInto('team_invitations')
      .values({
        team_id: teamId,
        email,
        role,
        token_hash: tokenHash,
        invited_by_user_id: invitedByUserId,
        status: 'pending',
        delivery_status: 'pending',
        expires_at: expiresAt,
        uuid: randomUUID(),
      })
      .execute()

    const created = await (db as any)
      .selectFrom('team_invitations')
      .where('token_hash', '=', tokenHash)
      .select(['id'])
      .executeTakeFirst()
    if (!created)
      return response.json({ message: 'The invitation could not be created.' }, 500)

    try {
      await deliverTeamInvitation({
        id: Number(created.id),
        email,
        teamName: String(team.name),
        role,
        token,
      })
    }
    catch {
      return response.json({ message: 'Invitation created, but email delivery failed. You can retry it from the invitation list.' }, 502)
    }

    return response.json({
      invitation: {
        id: Number(created.id),
        email,
        role,
        status: 'pending',
        deliveryStatus: 'sent',
        expiresAt,
      },
    }, 201)
  },
})
