/**
 * SMS Service Configuration Types
 * Supports Twilio, Vonage, and AWS providers
 */

// =============================================================================
// Core SMS Types
// =============================================================================

export type SmsProvider = 'twilio' | 'vonage' | 'pinpoint' | 'sns'

export interface SmsMessage {
  /**
   * Recipient phone number (E.164 format recommended)
   */
  to: string | string[]

  /**
   * Message body
   */
  body: string

  /**
   * Sender ID or phone number
   */
  from?: string

  /**
   * Optional media URLs (MMS)
   */
  mediaUrls?: string[]

  /**
   * Callback URL for status updates
   */
  statusCallback?: string

  /**
   * Additional provider-specific options
   */
  options?: Record<string, unknown>
}

export interface SmsSendResult {
  success: boolean
  messageId?: string
  status?: SmsStatus
  to: string
  error?: string
  provider: SmsProvider
  segments?: number
  price?: number
  currency?: string
}

export type SmsStatus =
  | 'queued'
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'failed'
  | 'undelivered'
  | 'unknown'

export interface SmsStatusUpdate {
  messageId: string
  to: string
  status: SmsStatus
  timestamp: Date
  errorCode?: string
  errorMessage?: string
}

// =============================================================================
// Provider Configurations
// =============================================================================

export interface TwilioConfig {
  accountSid: string
  authToken: string
  from?: string
  messagingServiceSid?: string
  statusCallback?: string
}

export interface VonageConfig {
  apiKey: string
  apiSecret: string
  from?: string
  applicationId?: string
  privateKey?: string
}

export interface AwsSmsConfig {
  region: string
  accessKeyId?: string
  secretAccessKey?: string
  senderId?: string
  originationNumber?: string
}

// =============================================================================
// SMS Options (Main Config)
// =============================================================================

export interface SmsTemplateConfig {
  name: string
  body: string
  variables?: string[]
}

export interface SmsOptOutConfig {
  enabled: boolean
  keywords: string[]
}

export interface SmsTwoWayConfig {
  enabled: boolean
  webhookUrl?: string
  snsTopicArn?: string
}

export interface SmsInboxConfig {
  enabled: boolean
  bucket: string
  prefix?: string
  retentionDays?: number
}

export interface SmsOptions {
  /**
   * Enable SMS functionality
   */
  enabled: boolean

  /**
   * Default SMS provider
   */
  provider: SmsProvider

  /**
   * Default sender ID or phone number
   */
  from?: string

  /**
   * Default country code for phone number formatting
   */
  defaultCountryCode?: string

  /**
   * Message type (affects pricing and delivery)
   */
  messageType?: 'TRANSACTIONAL' | 'PROMOTIONAL'

  /**
   * Provider-specific configurations
   */
  drivers: {
    twilio?: TwilioConfig
    vonage?: VonageConfig
    pinpoint?: AwsSmsConfig
    sns?: AwsSmsConfig
  }

  /**
   * Opt-out handling configuration
   */
  optOut?: SmsOptOutConfig

  /**
   * Two-way messaging configuration
   */
  twoWay?: SmsTwoWayConfig

  /**
   * Message templates
   */
  templates?: SmsTemplateConfig[]

  /**
   * Inbox configuration for storing received messages
   */
  inbox?: SmsInboxConfig

  /**
   * Max monthly spend limit
   */
  maxSpendPerMonth?: number
}

export type SmsConfig = Partial<SmsOptions>

// =============================================================================
// SMS Driver Interface
// =============================================================================

export interface SmsDriver {
  /**
   * Send an SMS message
   */
  send(message: SmsMessage): Promise<SmsSendResult>

  /**
   * Send multiple SMS messages
   */
  sendBulk(messages: SmsMessage[]): Promise<SmsSendResult[]>

  /**
   * Get message status
   */
  getStatus?(messageId: string): Promise<SmsStatusUpdate>

  /**
   * Verify a phone number
   */
  verify?(phoneNumber: string): Promise<{ valid: boolean, carrier?: string, type?: string }>

  /**
   * Get account balance/usage
   */
  getBalance?(): Promise<{ balance: number, currency: string }>
}

// =============================================================================
// Verification Types (for 2FA/OTP)
// =============================================================================

export interface VerificationRequest {
  to: string
  channel?: 'sms' | 'call' | 'whatsapp'
  codeLength?: number
  locale?: string
  customMessage?: string
}

export interface VerificationResult {
  success: boolean
  verificationId?: string
  status: 'pending' | 'approved' | 'denied' | 'expired'
  error?: string
}

export interface VerificationCheckRequest {
  verificationId?: string
  to: string
  code: string
}

export interface SmsVerificationDriver {
  /**
   * Start a verification (send OTP)
   */
  startVerification(request: VerificationRequest): Promise<VerificationResult>

  /**
   * Check a verification code
   */
  checkVerification(request: VerificationCheckRequest): Promise<VerificationResult>

  /**
   * Cancel a pending verification
   */
  cancelVerification?(verificationId: string): Promise<boolean>
}
