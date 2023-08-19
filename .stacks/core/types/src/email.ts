import { type IEmailOptions } from '@novu/stateless'

export type EmailOptions = Omit<IEmailOptions, 'from'> & {
  from: {
    name?: string
    address?: string
  }

  mailboxes?: {
    [key: string]: string
    // 'username': string
    // 'forwardTo': string
  }
}

export type EmailConfig = EmailOptions
