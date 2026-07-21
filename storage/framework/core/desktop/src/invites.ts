export interface InviteLinkOptions {
  email?: string
  team?: string
  role?: string
  expiresAt?: Date | string
}

export function createInviteLink(baseUrl: string, token: string, options: InviteLinkOptions = {}): string {
  if (!token.trim())
    throw new Error('Invite token is required')

  const url = new URL('/invite', /^https?:\/\//.test(baseUrl) ? baseUrl : `https://${baseUrl}`)
  url.searchParams.set('token', token)
  if (options.email) url.searchParams.set('email', options.email)
  if (options.team) url.searchParams.set('team', options.team)
  if (options.role) url.searchParams.set('role', options.role)
  if (options.expiresAt) {
    const date = options.expiresAt instanceof Date ? options.expiresAt : new Date(options.expiresAt)
    if (Number.isNaN(date.valueOf()))
      throw new Error('Invite expiration must be a valid date')
    url.searchParams.set('expires', date.toISOString())
  }
  return url.toString()
}

export interface DesktopInviteRecipient {
  email: string
  name?: string
  team?: string
  role?: string
}

export interface DesktopInviteDelivery {
  recipient: DesktopInviteRecipient
  url: string
  delivered: boolean
  error?: string
}

export interface SendDesktopInvitesOptions {
  baseUrl: string
  expiresAt?: Date | string
  createToken: (recipient: DesktopInviteRecipient) => string | Promise<string>
  send: (invite: { recipient: DesktopInviteRecipient, url: string }) => void | Promise<void>
}

export async function sendDesktopInvites(
  recipients: Array<string | DesktopInviteRecipient>,
  options: SendDesktopInvitesOptions,
): Promise<DesktopInviteDelivery[]> {
  return Promise.all(recipients.map(async (input) => {
    const recipient = typeof input === 'string' ? { email: input } : input
    try {
      assertEmail(recipient.email)
      const token = await options.createToken(recipient)
      const url = createInviteLink(options.baseUrl, token, {
        email: recipient.email,
        team: recipient.team,
        role: recipient.role,
        expiresAt: options.expiresAt,
      })
      await options.send({ recipient, url })
      return { recipient, url, delivered: true }
    }
    catch (error) {
      return {
        recipient,
        url: '',
        delivered: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }))
}

function assertEmail(email: string): void {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new Error(`Invalid invite email: ${email}`)
}
