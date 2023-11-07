import type { IEmailOptions } from '@novu/stateless'

export type EmailOptions = Omit<IEmailOptions, 'from'> & {
  from: {
    name?: string
    address?: string
  }

  mailboxes: string[]

  server: {
    scan?: boolean
  }
}

export type EmailConfig = Partial<EmailOptions>
