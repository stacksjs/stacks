/**
 * i18n bag passed to STX email templates at render time. Stacks emails
 * are STX, not vue-email — keys/values are user-defined per template.
 * The shape is intentionally open: each template declares its own
 * placeholders and the renderer interpolates them as-is.
 */
export interface I18n {
  [key: string]: unknown
}

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
   * - 'server': Full-featured Zig mail server with IMAP, POP3, CalDAV, etc. (default)
   * - 'serverless': Lightweight TypeScript/Bun server (~$3/month)
   * @default 'server'
   */
  mode?: 'serverless' | 'server'

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

  default: 'log' | 'ses' | 'sendgrid' | 'mailgun' | 'mailtrap' | 'smtp'

  /**
   * Suppression-list enforcement policy (stacksjs/stacks#1880).
   *
   * - `'strict'`                — block all sends to suppressed
   *   recipients (default)
   * - `'transactional-allowed'` — block broadcasts; allow messages
   *   with `tag: 'transactional'`
   * - `'off'`                   — never block; the suppression
   *   table is just a tracking record
   *
   * The check is opt-in at the table level — apps that haven't
   * created the `email_suppressions` table see "always allowed"
   * with a one-shot warn.
   */
  suppressionPolicy?: 'strict' | 'transactional-allowed' | 'off'

  /**
   * URL prefix the framework's default unsubscribe route mounts
   * under (stacksjs/stacks#1880). Defaults to
   * `/_stacks/email/unsubscribe`. The full link is built as
   * `${app.url}${unsubscribeRoute}/${signed-token}`.
   */
  unsubscribeRoute?: string
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
  /** Additional metadata from the email provider */
  metadata?: Record<string, unknown>
}

// Base configuration interface
export interface EmailDriverConfig {
  maxRetries?: number
  retryTimeout?: number
}

/** Options for email template rendering */
export interface EmailTemplateOptions {
  /** Template variables to replace */
  variables?: Record<string, string | number | boolean | undefined | null>
  /** Layout to wrap the template in */
  layout?: string | false
  /** Subject line for the email */
  subject?: string
}

// Email driver interface
export interface EmailDriver {
  /** Driver name */
  name: string

  /** Send an email */
  send: (message: EmailMessage, options?: EmailTemplateOptions) => Promise<EmailResult>

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
  /**
   * Reply-To address(es) for the outgoing message.
   *
   * Drivers must propagate this to the provider's equivalent field
   * (`ReplyToAddresses` on SES, `h:Reply-To` on Mailgun, `reply_to` on
   * SendGrid, a `Reply-To:` header for SMTP). Previously the field
   * lived as an `as any` stash on the message (stacksjs/stacks#1871 M-4)
   * — promoting it to a first-class slot means drivers can be
   * checked at compile time for coverage.
   */
  replyTo?: EmailAddress | EmailAddress[] | string | string[]
  /** Email subject line */
  subject: string
  /** Path to email template (Vue component) */
  template?: string
  /** Direct HTML content for the email body */
  html?: string
  /** Plain text fallback (recommended for accessibility) */
  text?: string
  /** Optional attachments */
  attachments?: EmailAttachment[]
  /**
   * Extra raw headers to inject into the outgoing envelope.
   * Used by the newsletter package for `List-Unsubscribe` /
   * `List-Unsubscribe-Post` (RFC 8058). Drivers that don't yet wire
   * this through silently ignore — it never affects transactional
   * sends.
   */
  headers?: Record<string, string>
  /** Optional callback after successful delivery */
  onSuccess?: () => Promise<{ message: string }> | { message: string }
  /** Optional callback after failed delivery */
  onError?: (error: Error) => Promise<{ message: string }> | { message: string }
  /** Optional custom handler */
  handle?: () => Promise<{ message: string }> | { message: string }
  /**
   * Caller-supplied idempotency key (stacksjs/stacks#1871 M-8).
   *
   * When set, `mail.send()` consults an `email_idempotency` dedup
   * table before dispatching to the driver:
   *   - hit: returns the cached EmailResult from the first send
   *   - miss: dispatches, then records the result under the key
   *
   * Why it matters: queued send retries (the framework retries 3×
   * with backoff) and external retry loops (webhook handlers that
   * re-fire on transient failures, request POSTs that the user
   * double-clicks) can otherwise deliver the same email multiple
   * times. The key turns those retries into safe no-ops.
   *
   * Construction guidance: derive the key from the business event
   * the email represents — e.g. `welcome:${userId}`,
   * `order-confirmation:${orderId}:${attempt}`, not from message
   * content (which would collide across unrelated sends).
   *
   * The dedup table is opt-in. When the migration hasn't been run
   * yet, the framework warns once and falls back to "send every
   * time" so unrelated apps aren't broken by the new behavior.
   */
  idempotencyKey?: string
  /**
   * Classification used by the suppression-policy check
   * (stacksjs/stacks#1880). Set to `'transactional'` for messages
   * that should bypass suppression when
   * `email.suppressionPolicy: 'transactional-allowed'` is
   * configured — password resets, billing receipts, magic-link
   * sign-ins.
   *
   * Set to `'broadcast'` (or omit) for marketing / newsletter
   * sends; those get blocked when the recipient is suppressed.
   *
   * Under the default `'strict'` policy this field has no effect
   * — both transactional and broadcast sends get blocked. Apps
   * that need to send password-reset emails to bounced addresses
   * (rare, but legitimate) opt into `'transactional-allowed'` AND
   * tag the message.
   */
  tag?: 'transactional' | 'broadcast'
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
