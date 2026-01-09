/**
 * SMS Facade
 *
 * Provides a unified interface for sending SMS messages across different providers.
 */

import type {
  SmsDriver,
  SmsMessage,
  SmsOptions,
  SmsProvider,
  SmsSendResult,
  SmsStatusUpdate,
  SmsVerificationDriver,
  VerificationCheckRequest,
  VerificationRequest,
  VerificationResult,
} from '@stacksjs/types'
import { TwilioDriver } from './drivers/twilio'
import { VonageDriver } from './drivers/vonage'

let defaultDriver: SmsDriver | null = null
let verificationDriver: SmsVerificationDriver | null = null
let smsConfig: Partial<SmsOptions> = {}

/**
 * Configure the SMS system
 */
export function configure(config: Partial<SmsOptions>): void {
  smsConfig = { ...smsConfig, ...config }
  defaultDriver = null
  verificationDriver = null
}

/**
 * Get the default SMS driver based on configuration
 */
export function getDriver(provider?: SmsProvider): SmsDriver {
  const targetProvider = provider || smsConfig.provider || 'twilio'

  switch (targetProvider) {
    case 'twilio': {
      const twilioConfig = smsConfig.drivers?.twilio
      if (!twilioConfig?.accountSid || !twilioConfig?.authToken) {
        throw new Error('Twilio configuration is incomplete. Please provide accountSid and authToken.')
      }
      return new TwilioDriver({
        ...twilioConfig,
        from: twilioConfig.from || smsConfig.from,
      })
    }

    case 'vonage': {
      const vonageConfig = smsConfig.drivers?.vonage
      if (!vonageConfig?.apiKey || !vonageConfig?.apiSecret) {
        throw new Error('Vonage configuration is incomplete. Please provide apiKey and apiSecret.')
      }
      return new VonageDriver({
        ...vonageConfig,
        from: vonageConfig.from || smsConfig.from,
      })
    }

    default:
      throw new Error(`Unsupported SMS provider: ${targetProvider}`)
  }
}

/**
 * Get the verification driver
 */
export function getVerificationDriver(provider?: SmsProvider): SmsVerificationDriver {
  const driver = getDriver(provider)

  if (!('startVerification' in driver)) {
    throw new Error(`Provider does not support verification: ${provider || smsConfig.provider}`)
  }

  return driver as SmsVerificationDriver
}

/**
 * Get or create the default driver
 */
function getDefaultDriver(): SmsDriver {
  if (!defaultDriver) {
    defaultDriver = getDriver()
  }
  return defaultDriver
}

/**
 * Get or create the verification driver
 */
function getDefaultVerificationDriver(): SmsVerificationDriver {
  if (!verificationDriver) {
    verificationDriver = getVerificationDriver()
  }
  return verificationDriver
}

// =============================================================================
// SMS Functions
// =============================================================================

/**
 * Send an SMS message
 */
export async function send(message: SmsMessage): Promise<SmsSendResult> {
  const driver = getDefaultDriver()
  return driver.send(message)
}

/**
 * Send an SMS message (alias)
 */
export const sendSms = send

/**
 * Send multiple SMS messages
 */
export async function sendBulk(messages: SmsMessage[]): Promise<SmsSendResult[]> {
  const driver = getDefaultDriver()
  return driver.sendBulk(messages)
}

/**
 * Get message status
 */
export async function getStatus(messageId: string): Promise<SmsStatusUpdate | null> {
  const driver = getDefaultDriver()
  if (driver.getStatus) {
    return driver.getStatus(messageId)
  }
  return null
}

/**
 * Verify a phone number format and carrier
 */
export async function verifyNumber(phoneNumber: string): Promise<{ valid: boolean, carrier?: string, type?: string }> {
  const driver = getDefaultDriver()
  if (driver.verify) {
    return driver.verify(phoneNumber)
  }
  return { valid: true }
}

/**
 * Get account balance
 */
export async function getBalance(): Promise<{ balance: number, currency: string } | null> {
  const driver = getDefaultDriver()
  if (driver.getBalance) {
    return driver.getBalance()
  }
  return null
}

// =============================================================================
// Verification (OTP/2FA) Functions
// =============================================================================

/**
 * Start a phone verification (send OTP)
 */
export async function startVerification(request: VerificationRequest): Promise<VerificationResult> {
  const driver = getDefaultVerificationDriver()
  return driver.startVerification(request)
}

/**
 * Check a verification code
 */
export async function checkVerification(request: VerificationCheckRequest): Promise<VerificationResult> {
  const driver = getDefaultVerificationDriver()
  return driver.checkVerification(request)
}

/**
 * Cancel a pending verification
 */
export async function cancelVerification(verificationId: string): Promise<boolean> {
  const driver = getDefaultVerificationDriver()
  if (driver.cancelVerification) {
    return driver.cancelVerification(verificationId)
  }
  return false
}

// =============================================================================
// SMS Builder (Fluent API)
// =============================================================================

export class SmsBuilder {
  private message: Partial<SmsMessage> = {}
  private provider?: SmsProvider

  /**
   * Set the recipient(s)
   */
  to(phoneNumber: string | string[]): this {
    this.message.to = phoneNumber
    return this
  }

  /**
   * Set the message body
   */
  body(text: string): this {
    this.message.body = text
    return this
  }

  /**
   * Alias for body()
   */
  text(text: string): this {
    return this.body(text)
  }

  /**
   * Set the sender ID or phone number
   */
  from(sender: string): this {
    this.message.from = sender
    return this
  }

  /**
   * Add media URLs (MMS)
   */
  media(urls: string | string[]): this {
    this.message.mediaUrls = Array.isArray(urls) ? urls : [urls]
    return this
  }

  /**
   * Set status callback URL
   */
  callback(url: string): this {
    this.message.statusCallback = url
    return this
  }

  /**
   * Use a specific provider
   */
  via(provider: SmsProvider): this {
    this.provider = provider
    return this
  }

  /**
   * Send the message
   */
  async send(): Promise<SmsSendResult> {
    if (!this.message.to) {
      return {
        success: false,
        to: '',
        error: 'Recipient is required',
        provider: this.provider || 'twilio',
      }
    }

    if (!this.message.body) {
      return {
        success: false,
        to: Array.isArray(this.message.to) ? this.message.to[0] : this.message.to,
        error: 'Message body is required',
        provider: this.provider || 'twilio',
      }
    }

    const driver = this.provider ? getDriver(this.provider) : getDefaultDriver()
    return driver.send(this.message as SmsMessage)
  }
}

/**
 * Create a new SMS builder
 */
export function sms(): SmsBuilder {
  return new SmsBuilder()
}

// =============================================================================
// Template Functions
// =============================================================================

/**
 * Send an SMS using a template
 */
export async function sendTemplate(
  to: string | string[],
  templateName: string,
  variables: Record<string, string> = {},
): Promise<SmsSendResult> {
  const template = smsConfig.templates?.find(t => t.name === templateName)

  if (!template) {
    return {
      success: false,
      to: Array.isArray(to) ? to[0] : to,
      error: `Template not found: ${templateName}`,
      provider: smsConfig.provider || 'twilio',
    }
  }

  let body = template.body
  for (const [key, value] of Object.entries(variables)) {
    body = body.replace(new RegExp(`\\{${key}\\}`, 'g'), value)
  }

  return send({ to, body })
}

// =============================================================================
// Phone Number Utilities
// =============================================================================

/**
 * Format a phone number to E.164 format
 */
export function formatE164(phoneNumber: string, defaultCountryCode?: string): string {
  let cleaned = phoneNumber.replace(/[\s\-()]/g, '')

  if (cleaned.startsWith('+')) {
    return cleaned
  }

  const countryCode = defaultCountryCode || smsConfig.defaultCountryCode || '1'

  if (cleaned.startsWith('00')) {
    cleaned = '+' + cleaned.slice(2)
  }
  else if (!cleaned.startsWith('+')) {
    cleaned = '+' + countryCode + cleaned
  }

  return cleaned
}

/**
 * Check if a phone number appears valid
 */
export function isValidPhoneNumber(phoneNumber: string): boolean {
  const e164Regex = /^\+[1-9]\d{6,14}$/
  const formatted = formatE164(phoneNumber)
  return e164Regex.test(formatted)
}

// =============================================================================
// SMS Facade Object
// =============================================================================

export const SMS = {
  configure,
  send,
  sendSms,
  sendBulk,
  sendTemplate,
  getStatus,
  getBalance,
  verifyNumber,
  startVerification,
  checkVerification,
  cancelVerification,
  formatE164,
  isValidPhoneNumber,
  sms,
  getDriver,
  getVerificationDriver,
}

export default SMS
