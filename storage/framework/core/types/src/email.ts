import type { I18n } from 'vue-email'

export interface EmailOptions {
  from: {
    name: string
    address: string
  }

  mailboxes: string[]

  url: string
  charset: string

  server: {
    scan?: boolean
  }

  default: 'ses' | 'sendgrid' | 'mailgun' | 'mailtrap'
}

export type EmailConfig = Partial<EmailOptions>

export interface MailtrapConfig extends EmailDriverConfig {
  token: string
  inboxId?: number
}
export interface EmailResult {
  message: string
  success: boolean
  provider: string
  messageId?: string
  [key: string]: any
}

// Base configuration interface
export interface EmailDriverConfig {
  maxRetries?: number
  retryTimeout?: number
  [key: string]: any
}

// Email driver interface
export interface EmailDriver {
  /** Driver name */
  name: string

  /** Send an email */
  send: (message: EmailMessage, options?: RenderOptions) => Promise<EmailResult>

  /** Configure the driver */
  configure: (config: EmailDriverConfig) => void
}

export interface EmailMessage {
  /** Sender email address (optional, will use config default if not provided) */
  from?: EmailAddress
  /** Primary recipient(s) */
  to: string | string[] | EmailAddress[]
  /** Carbon copy recipient(s) */
  cc?: string | string[] | EmailAddress[]
  /** Blind carbon copy recipient(s) */
  bcc?: string | string[] | EmailAddress[]
  /** Email subject line */
  subject: string
  /** Path to email template or HTML content */
  template?: string
  /** Optional plain text fallback */
  text?: string
  /** Optional attachments */
  attachments?: EmailAttachment[]
  /** Optional callback after successful delivery */
  onSuccess?: () => Promise<{ message: string }> | { message: string }
  /** Optional callback after failed delivery */
  onError?: (error: Error) => Promise<{ message: string }> | { message: string }
  /** Optional custom handler */
  handle?: () => Promise<{ message: string }> | { message: string }
}

// Email interfaces
export interface EmailAddress {
  address: string
  name?: string
}

export interface EmailAttachment {
  filename: string
  content: string | Uint8Array
  contentType?: string
  encoding?: 'base64' | 'binary' | 'hex' | 'utf8'
}
// Helper functions for all drivers

export interface SESConfig extends EmailDriverConfig {
  region: string
  credentials?: {
    accessKeyId: string
    secretAccessKey: string
  }
}

// SendGrid implementation
export interface SendGridConfig extends EmailDriverConfig {
  apiKey: string
}

export interface RenderOptions {
  props?: Record<string, unknown>
  i18n?: I18n
}

export interface MailtrapSuccessResponse {
  success: boolean
  message_ids: string[]
  errors?: never
}

export interface MailtrapErrorResponse {
  success: false
  errors: {
    email?: string[]
    message?: string[]
    [key: string]: string[] | undefined
  }
  message_ids?: never
}

export type MailtrapResponse = MailtrapSuccessResponse | MailtrapErrorResponse
