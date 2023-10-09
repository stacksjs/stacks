import type { IEmailOptions } from '@novu/stateless'

export type EmailOptions = Omit<IEmailOptions, 'from'> & {
  from: {
    name?: string
    address?: string
  }

  server: {
    scan?: boolean
    mailboxes: string[]
  }
}

export type EmailConfig = Partial<EmailOptions>
