import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'
import { response } from '@stacksjs/router'
import { invitationStatus, parsePositiveId } from './team-records'

export default new Action({
  name: 'Dashboard Team People Index',
  description: 'Returns one team with its active members and pending invitations.',
  method: 'GET',
  apiResponse: true,

  async handle(request: RequestInstance) {
    const teamId = parsePositiveId(request.getParam('id'))
    if (!teamId)
      return response.json({ message: 'Invalid team id.' }, 400)

    const team = await db
      .selectFrom('teams')
      .where('id', '=', teamId)
      .select(['id', 'name'])
      .executeTakeFirst()
    if (!team)
      return response.json({ message: 'Team not found.' }, 404)

    const members = await (db as any)
      .selectFrom('team_members')
      .innerJoin('users', 'users.id', '=', 'team_members.user_id')
      .where('team_members.team_id', '=', teamId)
      .select([
        'team_members.id as id',
        'team_members.user_id as user_id',
        'team_members.role as role',
        'team_members.status as status',
        'team_members.created_at as created_at',
        'users.name as name',
        'users.email as email',
      ])
      .orderBy('users.name', 'asc')
      .execute()

    const invitations = await (db as any)
      .selectFrom('team_invitations')
      .where('team_id', '=', teamId)
      .where('status', '=', 'pending')
      .select([
        'id',
        'email',
        'role',
        'status',
        'delivery_status',
        'expires_at',
        'created_at',
      ])
      .orderBy('created_at', 'desc')
      .execute()

    return {
      team: {
        id: Number(team.id),
        name: String(team.name),
      },
      members: members.map((member: any) => ({
        id: Number(member.id),
        userId: Number(member.user_id),
        name: String(member.name || member.email || 'Team member'),
        email: String(member.email || ''),
        role: String(member.role || 'member'),
        status: String(member.status || 'active'),
        joinedAt: member.created_at ? String(member.created_at) : null,
      })),
      invitations: invitations.map((invitation: any) => ({
        id: Number(invitation.id),
        email: String(invitation.email),
        role: String(invitation.role || 'member'),
        status: invitationStatus(invitation.status, invitation.expires_at),
        deliveryStatus: String(invitation.delivery_status || 'pending'),
        expiresAt: String(invitation.expires_at),
        createdAt: invitation.created_at ? String(invitation.created_at) : null,
      })),
    }
  },
})
