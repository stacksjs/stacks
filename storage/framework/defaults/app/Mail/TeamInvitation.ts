import { config } from '@stacksjs/config'
import { mail, template } from '@stacksjs/email'

export interface TeamInvitationMailOptions {
  to: string
  teamName: string
  role: string
  invitationUrl: string
  expiresInDays: number
}

export async function sendTeamInvitation(options: TeamInvitationMailOptions): Promise<void> {
  const appName = config.app.name || 'Stacks'
  const subject = `You are invited to join ${options.teamName}`
  const { html, text } = await template('team-invitation', {
    variables: {
      appName,
      teamName: options.teamName,
      role: options.role,
      invitationUrl: options.invitationUrl,
      expiresInDays: options.expiresInDays,
    },
    subject,
  })

  await mail.send({
    to: [options.to],
    from: {
      name: config.email.from?.name || appName,
      address: config.email.from?.address || 'hello@stacksjs.com',
    },
    subject,
    html,
    text,
  })
}

export default sendTeamInvitation
