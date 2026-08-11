import { config } from '@stacksjs/config'
import { db } from '@stacksjs/database'
import { sendTeamInvitation } from '../../../Mail/TeamInvitation'
import { teamOperationalIssue } from '../../Teams/team-response'
import { changedRows, invitationUrl, sqlTimestamp } from './team-records'

interface DeliveryInput {
  id: number
  email: string
  teamName: string
  role: string
  token: string
  tokenHash: string
}

async function recordDeliveryFailure(input: DeliveryInput, message: string): Promise<void> {
  try {
    await markTeamInvitationDeliveryFailed(input.id, input.tokenHash, message)
  }
  catch (error) {
    teamOperationalIssue(error, 'Invitation delivery failure could not be recorded.', 'deliverTeamInvitation.failureStatus')
  }
}

export async function deliverTeamInvitation(input: DeliveryInput): Promise<void> {
  const baseUrl = String(process.env.APP_URL || config.app.url || '').trim()
  if (!baseUrl) {
    await recordDeliveryFailure(input, 'APP_URL is not configured.')
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
  }
  catch (error) {
    const message = teamOperationalIssue(error, 'Email delivery failed.', 'deliverTeamInvitation.provider')
    await recordDeliveryFailure(input, message)
    throw error
  }

  try {
    const result = await (db as any)
      .updateTable('team_invitations')
      .set({
        delivery_status: 'sent',
        delivery_error: null,
        delivered_at: sqlTimestamp(),
        updated_at: sqlTimestamp(),
      })
      .where('id', '=', input.id)
      .where('token_hash', '=', input.tokenHash)
      .executeTakeFirst()
    if (changedRows(result) !== 1)
      throw new Error('Invitation delivery status changed before it could be recorded.')
  }
  catch (error) {
    teamOperationalIssue(error, 'Invitation delivery success could not be recorded.', 'deliverTeamInvitation.successStatus')
    throw error
  }
}

export async function markTeamInvitationDeliveryFailed(id: number, tokenHash: string, error: string): Promise<void> {
  await (db as any)
    .updateTable('team_invitations')
    .set({
      delivery_status: 'failed',
      delivery_error: error.slice(0, 2000),
      updated_at: sqlTimestamp(),
    })
    .where('id', '=', id)
    .where('token_hash', '=', tokenHash)
    .execute()
}
