import { config } from '@stacksjs/config'
import { db } from '@stacksjs/database'
import { sendTeamInvitation } from '../../../Mail/TeamInvitation'
import { invitationUrl, sqlTimestamp } from './team-records'

interface DeliveryInput {
  id: number
  email: string
  teamName: string
  role: string
  token: string
}

export async function deliverTeamInvitation(input: DeliveryInput): Promise<void> {
  const baseUrl = String(process.env.APP_URL || config.app.url || '').trim()
  if (!baseUrl) {
    await markTeamInvitationDeliveryFailed(input.id, 'APP_URL is not configured.')
    throw new Error('APP_URL must be configured before invitations can be delivered.')
  }

  try {
    await sendTeamInvitation({
      to: input.email,
      teamName: input.teamName,
      role: input.role,
      invitationUrl: invitationUrl(baseUrl, input.token),
      expiresInDays: 7,
    })
    await (db as any)
      .updateTable('team_invitations')
      .set({
        delivery_status: 'sent',
        delivery_error: null,
        delivered_at: sqlTimestamp(),
        updated_at: sqlTimestamp(),
      })
      .where('id', '=', input.id)
      .execute()
  }
  catch (error) {
    const message = error instanceof Error ? error.message : 'Email delivery failed.'
    await markTeamInvitationDeliveryFailed(input.id, message)
    throw error
  }
}

export async function markTeamInvitationDeliveryFailed(id: number, error: string): Promise<void> {
  await (db as any)
    .updateTable('team_invitations')
    .set({
      delivery_status: 'failed',
      delivery_error: error.slice(0, 2000),
      updated_at: sqlTimestamp(),
    })
    .where('id', '=', id)
    .execute()
}
