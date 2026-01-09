/**
 * Twilio SMS Driver
 *
 * Full-featured SMS driver using Twilio's REST API.
 */

import type {
  SmsDriver,
  SmsMessage,
  SmsSendResult,
  SmsStatus,
  SmsStatusUpdate,
  SmsVerificationDriver,
  TwilioConfig,
  VerificationCheckRequest,
  VerificationRequest,
  VerificationResult,
} from '@stacksjs/types'

const API_BASE = 'https://api.twilio.com/2010-04-01'
const VERIFY_API_BASE = 'https://verify.twilio.com/v2'

export class TwilioDriver implements SmsDriver, SmsVerificationDriver {
  private config: TwilioConfig
  private verifyServiceSid?: string

  constructor(config: TwilioConfig, verifyServiceSid?: string) {
    this.config = config
    this.verifyServiceSid = verifyServiceSid
  }

  /**
   * Send an SMS message
   */
  async send(message: SmsMessage): Promise<SmsSendResult> {
    const recipients = Array.isArray(message.to) ? message.to : [message.to]

    if (recipients.length > 1) {
      const results = await this.sendBulk(
        recipients.map(to => ({ ...message, to })),
      )
      return results[0]
    }

    const to = recipients[0]
    const from = message.from || this.config.from

    if (!from && !this.config.messagingServiceSid) {
      return {
        success: false,
        to,
        error: 'No "from" number or messaging service SID configured',
        provider: 'twilio',
      }
    }

    try {
      const body = new URLSearchParams()
      body.append('To', to)
      body.append('Body', message.body)

      if (this.config.messagingServiceSid) {
        body.append('MessagingServiceSid', this.config.messagingServiceSid)
      }
      else if (from) {
        body.append('From', from)
      }

      if (message.statusCallback || this.config.statusCallback) {
        body.append('StatusCallback', message.statusCallback || this.config.statusCallback!)
      }

      if (message.mediaUrls && message.mediaUrls.length > 0) {
        for (const mediaUrl of message.mediaUrls) {
          body.append('MediaUrl', mediaUrl)
        }
      }

      const response = await fetch(
        `${API_BASE}/Accounts/${this.config.accountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${btoa(`${this.config.accountSid}:${this.config.authToken}`)}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: body.toString(),
        },
      )

      const data = await response.json() as TwilioMessageResponse

      if (!response.ok) {
        return {
          success: false,
          to,
          error: data.message || `HTTP ${response.status}`,
          provider: 'twilio',
        }
      }

      return {
        success: true,
        messageId: data.sid,
        status: mapTwilioStatus(data.status),
        to,
        provider: 'twilio',
        segments: data.num_segments ? Number.parseInt(data.num_segments, 10) : undefined,
        price: data.price ? Math.abs(Number.parseFloat(data.price)) : undefined,
        currency: data.price_unit,
      }
    }
    catch (error) {
      return {
        success: false,
        to,
        error: error instanceof Error ? error.message : 'Unknown error',
        provider: 'twilio',
      }
    }
  }

  /**
   * Send multiple SMS messages
   */
  async sendBulk(messages: SmsMessage[]): Promise<SmsSendResult[]> {
    return Promise.all(
      messages.map(msg => this.send({ ...msg, to: Array.isArray(msg.to) ? msg.to[0] : msg.to })),
    )
  }

  /**
   * Get message status
   */
  async getStatus(messageId: string): Promise<SmsStatusUpdate> {
    const response = await fetch(
      `${API_BASE}/Accounts/${this.config.accountSid}/Messages/${messageId}.json`,
      {
        headers: {
          Authorization: `Basic ${btoa(`${this.config.accountSid}:${this.config.authToken}`)}`,
        },
      },
    )

    const data = await response.json() as TwilioMessageResponse

    return {
      messageId: data.sid,
      to: data.to,
      status: mapTwilioStatus(data.status),
      timestamp: new Date(data.date_updated || data.date_created),
      errorCode: data.error_code?.toString(),
      errorMessage: data.error_message,
    }
  }

  /**
   * Verify a phone number using Twilio Lookup API
   */
  async verify(phoneNumber: string): Promise<{ valid: boolean, carrier?: string, type?: string }> {
    try {
      const response = await fetch(
        `https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(phoneNumber)}?Fields=line_type_intelligence`,
        {
          headers: {
            Authorization: `Basic ${btoa(`${this.config.accountSid}:${this.config.authToken}`)}`,
          },
        },
      )

      if (!response.ok) {
        return { valid: false }
      }

      const data = await response.json() as TwilioLookupResponse

      return {
        valid: data.valid,
        carrier: data.line_type_intelligence?.carrier_name,
        type: data.line_type_intelligence?.type,
      }
    }
    catch {
      return { valid: false }
    }
  }

  /**
   * Get account balance
   */
  async getBalance(): Promise<{ balance: number, currency: string }> {
    const response = await fetch(
      `${API_BASE}/Accounts/${this.config.accountSid}/Balance.json`,
      {
        headers: {
          Authorization: `Basic ${btoa(`${this.config.accountSid}:${this.config.authToken}`)}`,
        },
      },
    )

    const data = await response.json() as TwilioBalanceResponse

    return {
      balance: Number.parseFloat(data.balance),
      currency: data.currency,
    }
  }

  // =============================================================================
  // Verification (2FA/OTP)
  // =============================================================================

  /**
   * Start a verification (send OTP)
   */
  async startVerification(request: VerificationRequest): Promise<VerificationResult> {
    if (!this.verifyServiceSid) {
      return {
        success: false,
        status: 'denied',
        error: 'Verify service SID not configured',
      }
    }

    try {
      const body = new URLSearchParams()
      body.append('To', request.to)
      body.append('Channel', request.channel || 'sms')

      if (request.locale) {
        body.append('Locale', request.locale)
      }

      if (request.customMessage) {
        body.append('CustomMessage', request.customMessage)
      }

      const response = await fetch(
        `${VERIFY_API_BASE}/Services/${this.verifyServiceSid}/Verifications`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${btoa(`${this.config.accountSid}:${this.config.authToken}`)}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: body.toString(),
        },
      )

      const data = await response.json() as TwilioVerificationResponse

      if (!response.ok) {
        return {
          success: false,
          status: 'denied',
          error: data.message || `HTTP ${response.status}`,
        }
      }

      return {
        success: true,
        verificationId: data.sid,
        status: data.status === 'pending' ? 'pending' : 'denied',
      }
    }
    catch (error) {
      return {
        success: false,
        status: 'denied',
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Check a verification code
   */
  async checkVerification(request: VerificationCheckRequest): Promise<VerificationResult> {
    if (!this.verifyServiceSid) {
      return {
        success: false,
        status: 'denied',
        error: 'Verify service SID not configured',
      }
    }

    try {
      const body = new URLSearchParams()
      body.append('To', request.to)
      body.append('Code', request.code)

      const response = await fetch(
        `${VERIFY_API_BASE}/Services/${this.verifyServiceSid}/VerificationCheck`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${btoa(`${this.config.accountSid}:${this.config.authToken}`)}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: body.toString(),
        },
      )

      const data = await response.json() as TwilioVerificationCheckResponse

      if (!response.ok) {
        return {
          success: false,
          status: 'denied',
          error: data.message || `HTTP ${response.status}`,
        }
      }

      return {
        success: data.status === 'approved',
        verificationId: data.sid,
        status: data.status === 'approved' ? 'approved' : 'denied',
      }
    }
    catch (error) {
      return {
        success: false,
        status: 'denied',
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Cancel a pending verification
   */
  async cancelVerification(verificationId: string): Promise<boolean> {
    if (!this.verifyServiceSid) {
      return false
    }

    try {
      const body = new URLSearchParams()
      body.append('Status', 'canceled')

      const response = await fetch(
        `${VERIFY_API_BASE}/Services/${this.verifyServiceSid}/Verifications/${verificationId}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${btoa(`${this.config.accountSid}:${this.config.authToken}`)}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: body.toString(),
        },
      )

      return response.ok
    }
    catch {
      return false
    }
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

function mapTwilioStatus(status: string): SmsStatus {
  const statusMap: Record<string, SmsStatus> = {
    queued: 'queued',
    sending: 'sending',
    sent: 'sent',
    delivered: 'delivered',
    undelivered: 'undelivered',
    failed: 'failed',
    canceled: 'failed',
  }

  return statusMap[status] || 'unknown'
}

// =============================================================================
// Twilio API Response Types
// =============================================================================

interface TwilioMessageResponse {
  sid: string
  to: string
  from: string
  body: string
  status: string
  num_segments?: string
  price?: string
  price_unit?: string
  date_created: string
  date_updated?: string
  error_code?: number
  error_message?: string
  message?: string
}

interface TwilioLookupResponse {
  valid: boolean
  phone_number: string
  country_code: string
  line_type_intelligence?: {
    carrier_name?: string
    type?: string
  }
}

interface TwilioBalanceResponse {
  balance: string
  currency: string
}

interface TwilioVerificationResponse {
  sid: string
  status: string
  message?: string
}

interface TwilioVerificationCheckResponse {
  sid: string
  status: string
  valid: boolean
  message?: string
}

// =============================================================================
// Factory Function
// =============================================================================

export function createTwilioDriver(config: TwilioConfig, verifyServiceSid?: string): TwilioDriver {
  return new TwilioDriver(config, verifyServiceSid)
}

export { TwilioDriver as default }
