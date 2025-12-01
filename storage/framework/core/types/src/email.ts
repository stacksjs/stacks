import type { I18n } from 'vue-email'

export interface AutoResponderConfig {
  enabled: boolean
  subject: string
  body: string
  schedule?: {
    start?: string
    end?: string
  }
}

export interface EmailFilterRule {
  field: 'from' | 'to' | 'subject' | 'body'
  operator: 'contains' | 'equals' | 'startsWith' | 'endsWith' | 'regex'
  value: string
  action: 'move' | 'delete' | 'forward' | 'label'
  actionValue?: string
}

export interface MailboxConfig {
  address: string
  displayName?: string
  forwardTo?: string[]
  autoResponder?: AutoResponderConfig
  filters?: EmailFilterRule[]
}

export interface MailServerInstanceConfig {
  /**
   * EC2 instance type for the mail server
   * @default 't4g.nano'
   */
  type?: 't4g.nano' | 't4g.micro' | 't4g.small' | 't4g.medium' | 't3.nano' | 't3.micro' | 't3.small' | 't3.medium'

  /**
   * Use spot instance for cost savings (~70% cheaper)
   * Note: Spot instances can be interrupted with 2-minute warning
   * @default false
   */
  spot?: boolean

  /**
   * Root volume size in GB
   * @default 8
   */
  diskSize?: number

  /**
   * SSH key pair name for instance access (optional)
   */
  keyPair?: string
}

export interface MailServerPortsConfig {
  /**
   * IMAP port (TLS)
   * @default 993
   */
  imap?: number

  /**
   * SMTP submission port (TLS)
   * @default 465
   */
  smtp?: number

  /**
   * SMTP submission port (STARTTLS)
   * @default 587
   */
  smtpStartTls?: number
}

export interface EmailServerConfig {
  enabled: boolean
  scan?: boolean // spam/virus scanning
  storage?: {
    bucket?: string
    retentionDays?: number
    archiveAfterDays?: number
  }
  forwarding?: Record<string, string[]> // alias -> destinations
  autoResponders?: AutoResponderConfig[]

  /**
   * Mail server instance configuration
   * Controls the EC2 instance that runs IMAP/SMTP
   */
  instance?: MailServerInstanceConfig

  /**
   * Mail server ports configuration
   */
  ports?: MailServerPortsConfig

  /**
   * Subdomain for the mail server
   * @default 'mail'
   * @example 'mail' -> mail.yourdomain.com
   */
  subdomain?: string
}

export interface EmailNotificationsConfig {
  newEmail?: boolean
  bounces?: boolean
  complaints?: boolean
}

export interface EmailOptions {
  from: {
    name: string
    address: string
  }

  mailboxes: string[] | MailboxConfig[]
  domain?: string

  url: string
  charset: string

  server: EmailServerConfig
  notifications?: EmailNotificationsConfig

  default: 'ses' | 'sendgrid' | 'mailgun' | 'mailtrap' | 'smtp' | 'postmark'
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
