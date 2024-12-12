export interface EmailOptions {
  from: {
    name: string
    address: string
  }

  mailboxes: string[]

  url: string
  charset: string // e.g. UTF-8

  server: {
    scan?: boolean
  }
}

export type EmailConfig = Partial<EmailOptions>
