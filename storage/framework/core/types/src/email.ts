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
  /** Email address (preferred) - e.g., 'chris@stacksjs.com' */
  email?: string
  /** @deprecated Use 'email' instead */
  address?: string
  displayName?: string
  /**
   * Password for IMAP/SMTP authentication.
   * If not provided, will be looked up from MAIL_PASSWORD_<USERNAME> env var.
   * Passwords are stored in AWS Secrets Manager after first deploy.
   */
  password?: string
  forwardTo?: string[]
  autoResponder?: AutoResponderConfig
  filters?: EmailFilterRule[]
}

export interface MailServerInstanceConfig {
  /**
   * EC2 instance type for the mail server
   * @default 't4g.nano' for serverless, 't3.small' for server mode
   */
  type?: 't4g.nano' | 't4g.micro' | 't4g.small' | 't4g.medium' | 't3.nano' | 't3.micro' | 't3.small' | 't3.medium' | 't3.large' | 't3.xlarge'

  /**
   * Use spot instance for cost savings (~70% cheaper)
   * Note: Spot instances can be interrupted with 2-minute warning
   * @default false
   */
  spot?: boolean

  /**
   * Root volume size in GB
   * @default 8 for serverless, 30 for server mode
   */
  diskSize?: number

  /**
   * SSH key pair name for instance access (optional)
   */
  keyPair?: string
}

export interface MailServerPortsConfig {
  /**
   * Standard SMTP port
   * @default 25
   */
  smtp?: number

  /**
   * SMTP over TLS (implicit TLS)
   * @default 465
   */
  smtps?: number

  /**
   * SMTP submission port (STARTTLS)
   * @default 587
   */
  submission?: number

  /**
   * IMAP port (plaintext, not recommended)
   * @default 143
   */
  imap?: number

  /**
   * IMAP over TLS
   * @default 993
   */
  imaps?: number

  /**
   * POP3 port (plaintext, not recommended)
   * @default 110
   */
  pop3?: number

  /**
   * POP3 over TLS
   * @default 995
   */
  pop3s?: number

  /**
   * @deprecated Use 'submission' instead
   */
  smtpStartTls?: number
}

export interface MailServerFeaturesConfig {
  /**
   * Enable IMAP server
   * @default true
   */
  imap?: boolean

  /**
   * Enable POP3 server
   * @default true
   */
  pop3?: boolean

  /**
   * Enable webmail interface (future)
   * @default false
   */
  webmail?: boolean

  /**
   * Enable CalDAV for calendar sync
   * @default false
   */
  calDAV?: boolean

  /**
   * Enable CardDAV for contacts sync
   * @default false
   */
  cardDAV?: boolean

  /**
   * Enable Exchange ActiveSync
   * @default false
   */
  activeSync?: boolean
}

/**
 * Email category types for automatic email categorization (Gmail-style)
 */
export type EmailCategory = 'social' | 'forums' | 'updates' | 'promotions' | 'primary'

/**
 * Patterns for matching emails to categories
 */
export interface CategoryPatterns {
  /**
   * Domain names to match (e.g., 'facebookmail.com', 'twitter.com')
   * Matched against the sender's email domain
   */
  domains?: string[]

  /**
   * Substrings to match in the sender address (e.g., 'notification@', '@social.')
   */
  substrings?: string[]

  /**
   * Email headers to match (e.g., { 'list-id': [''], 'precedence': ['list', 'bulk'] })
   * Empty string array means "header exists"
   */
  headers?: Record<string, string[]>
}

/**
 * Configuration for automatic email categorization
 */
export interface EmailCategorizationConfig {
  /**
   * Enable automatic email categorization into Gmail-style folders
   * @default true
   */
  enabled?: boolean

  /**
   * Social category patterns (Facebook, Twitter, LinkedIn, etc.)
   */
  social?: CategoryPatterns

  /**
   * Forums category patterns (mailing lists, Google Groups, etc.)
   */
  forums?: CategoryPatterns

  /**
   * Updates category patterns (GitHub, Stripe, shipping notifications, etc.)
   */
  updates?: CategoryPatterns

  /**
   * Promotions category patterns (marketing emails, newsletters, etc.)
   */
  promotions?: CategoryPatterns
}

export interface EmailServerConfig {
  enabled: boolean
  scan?: boolean // spam/virus scanning

  /**
   * Server mode:
   * - 'serverless': Lightweight TypeScript/Bun server (default, ~$3/month)
   * - 'server': Full-featured Zig mail server with IMAP, POP3, CalDAV, etc.
   * @default 'serverless'
   */
  mode?: 'serverless' | 'server'

  /**
   * Path to the Zig mail server repository (only used when mode is 'server')
   * @default process.env.MAIL_SERVER_PATH
   */
  serverPath?: string

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
   * Mail server features (only available in 'server' mode)
   */
  features?: MailServerFeaturesConfig

  /**
   * Subdomain for the mail server
   * @default 'mail'
   * @example 'mail' -> mail.yourdomain.com
   */
  subdomain?: string

  /**
   * Automatic email categorization (Gmail-style folders)
   * Categorizes incoming emails into Social, Forums, Updates, Promotions folders
   */
  categorization?: EmailCategorizationConfig
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
