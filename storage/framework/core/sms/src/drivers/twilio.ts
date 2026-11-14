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

export interface TwilioTransportOptions {
  fetch?: typeof fetch
  /** Only explicit 429 rejections are retried for message creation. */
  maxRetries?: number
}

export interface TwilioSendResult extends SmsSendResult {
  outcome?: 'accepted' | 'rejected' | 'unknown'
  httpStatus?: number
  providerCode?: number
  /** Exact absolute provider price in millionths of the quoted currency. */
  priceMicros?: number
}

export interface TwilioReceipt {
  messageId: string
  from?: string
  to?: string
  createdAt?: string
  body?: string
  status: SmsStatus
  price?: string | null
  priceMicros?: number
  currency?: string
  segments?: number
}

/** Parse a decimal provider price without floating-point currency rounding. */
export function twilioPriceMicros(value: string | null | undefined): number | undefined {
  if (typeof value !== 'string' || !/^-?\d+(?:\.\d{1,6})?$/.test(value))
    return undefined
  const [whole, fraction = ''] = value.replace(/^-/, '').split('.')
  const micros = BigInt(whole!) * 1000000n + BigInt(fraction.padEnd(6, '0'))
  return micros <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(micros) : undefined
}

async function fetchWithRetry(fetcher: typeof fetch, url: string, init: RequestInit, maxRetries = 3): Promise<Response> {
  let attempt = 0
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const response = await fetcher(url, { ...init, redirect: 'error', signal: init.signal ?? AbortSignal.timeout(15000) })
    // Message creation has no general idempotency guarantee. A 503 or lost
    // acknowledgement might follow acceptance; resending can duplicate it.
    if (response.status !== 429 || attempt >= maxRetries)
      return response
    const retryHeader = response.headers.get('retry-after')
    const seconds = retryHeader === null ? 2 ** attempt : Number(retryHeader)
    await new Promise(r => setTimeout(r, Math.max(0, Math.min(Number.isFinite(seconds) ? seconds : 2 ** attempt, 30)) * 1000))
    attempt++
  }
}

export class TwilioDriver implements SmsDriver, SmsVerificationDriver {
  private config: TwilioConfig
  private verifyServiceSid?: string
  private readonly fetcher: typeof fetch
  private readonly maxRetries: number

  constructor(config: TwilioConfig, verifyServiceSid?: string, transport: TwilioTransportOptions = {}) {
    this.config = { ...config }
    this.fetcher = transport.fetch ?? ((input, init) => fetch(input, init)) as typeof fetch
    this.maxRetries = transport.maxRetries ?? 3
    this.verifyServiceSid = verifyServiceSid
  }

  /**
   * Send an SMS message
   */
  async send(message: SmsMessage): Promise<TwilioSendResult> {
    const recipients = Array.isArray(message.to) ? message.to : [message.to]

    if (recipients.length > 1) {
      const results = await this.sendBulk(
        recipients.map(to => ({ ...message, to })),
      )
      return results[0] ?? {
        success: false,
        to: recipients[0] ?? '',
        error: 'No recipients supplied',
        provider: 'twilio',
      }
    }

    const to = recipients[0]
    if (!to) {
      return {
        success: false,
        to: '',
        error: 'No recipient supplied',
        provider: 'twilio',
      }
    }
    const from = message.from || this.config.from

    if (!from && !this.config.messagingServiceSid) {
      return {
        success: false,
        to,
        error: 'No "from" number or messaging service SID configured',
        provider: 'twilio',
      }
    }

    const contentSid = message.options?.contentSid
    const variables = message.options?.contentVariables
    if (contentSid !== undefined && (typeof contentSid !== 'string' || !/^HX[a-f0-9]{32}$/i.test(contentSid)))
      return { success: false, to, provider: 'twilio', outcome: 'rejected', error: 'Invalid Twilio Content SID' }
    if (contentSid && message.mediaUrls?.length)
      return { success: false, to, provider: 'twilio', outcome: 'rejected', error: 'Content templates cannot include MediaUrl' }
    if (variables !== undefined && (!contentSid || !variables || typeof variables !== 'object' || Array.isArray(variables)
      || Object.entries(variables).some(([key, value]) => !/^\d+$/.test(key) || typeof value !== 'string' || value.length > 1600)))
      return { success: false, to, provider: 'twilio', outcome: 'rejected', error: 'Content variables require a Content SID and numbered string values' }

    try {
      const body = new URLSearchParams()
      body.append('To', to)
      if (contentSid) {
        body.append('ContentSid', String(contentSid))
        if (variables)
          body.append('ContentVariables', JSON.stringify(variables))
      }
      else if (message.body) {
        body.append('Body', message.body)
      }

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

      const response = await fetchWithRetry(
        this.fetcher,
        `${API_BASE}/Accounts/${this.config.accountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${btoa(`${this.config.accountSid}:${this.config.authToken}`)}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: body.toString(),
        },
        this.maxRetries,
      )

      const data = await response.json() as TwilioMessageResponse

      if (!response.ok) {
        return {
          success: false,
          to,
          error: data.message || `HTTP ${response.status}`,
          provider: 'twilio',
          outcome: response.status >= 500 || response.status === 408 ? 'unknown' : 'rejected',
          httpStatus: response.status,
          providerCode: data.code,
        }
      }

      if (!data.sid)
        return { success: false, to, provider: 'twilio', outcome: 'unknown', error: 'Twilio acknowledgement has no message SID', httpStatus: response.status }

      return {
        success: true,
        outcome: 'accepted',
        httpStatus: response.status,
        priceMicros: twilioPriceMicros(data.price),
        messageId: data.sid,
        status: mapTwilioStatus(data.status),
        to,
        provider: 'twilio',
        segments: data.num_segments ? Number.parseInt(data.num_segments, 10) : undefined,
        price: data.price ? Math.abs(Number.parseFloat(data.price)) : undefined,
        currency: data.price_unit,
      }
    }
    catch {
      return {
        success: false,
        to,
        error: 'Twilio acknowledgement unavailable',
        provider: 'twilio',
        outcome: 'unknown',
      }
    }
  }

  /**
   * Send multiple SMS messages
   */
  async sendBulk(messages: SmsMessage[]): Promise<SmsSendResult[]> {
    return Promise.all(
      messages.map(msg => this.send(msg)),
    )
  }

  /**
   * Get message status
   */
  async getStatus(messageId: string): Promise<SmsStatusUpdate> {
    const response = await this.fetcher(
      `${API_BASE}/Accounts/${this.config.accountSid}/Messages/${messageId}.json`,
      {
        headers: {
          Authorization: `Basic ${btoa(`${this.config.accountSid}:${this.config.authToken}`)}`,
        },
      },
    )

    if (!response.ok) {
      throw new Error(`Twilio message status API error: ${response.status}`)
    }

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

  private async readMessagingResource(url: string): Promise<Record<string, unknown>> {
    const response = await this.fetcher(url, {
      headers: { Authorization: `Basic ${btoa(`${this.config.accountSid}:${this.config.authToken}`)}` },
      redirect: 'error', signal: AbortSignal.timeout(15000),
    })
    if (!response.ok)
      throw new Error(`Twilio messaging resource HTTP ${response.status}`)
    return await response.json() as Record<string, unknown>
  }

  /** Read-only probe of a registered WhatsApp sender. Never registers or purchases a number. */
  async getWhatsAppSender(senderSid: string): Promise<{ sid: string, senderId: string, status: string, callbackUrl?: string }> {
    if (!/^XE[a-f0-9]{32}$/i.test(senderSid))
      throw new Error('Invalid Twilio WhatsApp Sender SID')
    const data = await this.readMessagingResource(`https://messaging.twilio.com/v2/Channels/Senders/${senderSid}`)
    if (data.sid !== senderSid || typeof data.sender_id !== 'string' || typeof data.status !== 'string')
      throw new Error('Twilio WhatsApp sender acknowledgement mismatch')
    const webhook = data.webhook && typeof data.webhook === 'object' ? data.webhook as Record<string, unknown> : {}
    return { sid: senderSid, senderId: data.sender_id, status: data.status, callbackUrl: typeof webhook.callback_url === 'string' ? webhook.callback_url : undefined }
  }

  /** Fresh approval must be checked before an out-of-window WhatsApp template send. */
  async getContentApproval(contentSid: string): Promise<{ sid: string, status: string, category?: string }> {
    if (!/^HX[a-f0-9]{32}$/i.test(contentSid))
      throw new Error('Invalid Twilio Content SID')
    const data = await this.readMessagingResource(`https://content.twilio.com/v1/Content/${contentSid}/ApprovalRequests`)
    if (data.sid !== contentSid || data.account_sid !== this.config.accountSid)
      throw new Error('Twilio content approval account mismatch')
    const whatsapp = data.whatsapp && typeof data.whatsapp === 'object' ? data.whatsapp as Record<string, unknown> : {}
    if (typeof whatsapp.status !== 'string')
      throw new Error('Twilio content approval status unavailable')
    return { sid: contentSid, status: whatsapp.status, category: typeof whatsapp.category === 'string' ? whatsapp.category : undefined }
  }

  /** Retrieve authoritative status and the exact quoted provider cost. */
  async getReceipt(messageId: string): Promise<TwilioReceipt> {
    if (!/^SM[a-f0-9]{32}$/i.test(messageId) && !/^MM[a-f0-9]{32}$/i.test(messageId))
      throw new Error('Invalid Twilio message SID')
    const response = await this.fetcher(`${API_BASE}/Accounts/${this.config.accountSid}/Messages/${messageId}.json`, {
      headers: { Authorization: `Basic ${btoa(`${this.config.accountSid}:${this.config.authToken}`)}` },
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    })
    if (!response.ok)
      throw new Error(`Twilio receipt API error: ${response.status}`)
    const data = await response.json() as TwilioMessageResponse
    if (data.sid !== messageId)
      throw new Error('Twilio receipt SID mismatch')
    return { messageId: data.sid, from: data.from, to: data.to, createdAt: data.date_created, body: data.body, status: mapTwilioStatus(data.status), price: data.price ?? undefined,
      priceMicros: twilioPriceMicros(data.price), currency: data.price_unit,
      segments: data.num_segments ? Number.parseInt(data.num_segments, 10) : undefined }
  }

  /**
   * Verify a phone number using Twilio Lookup API
   */
  async verify(phoneNumber: string): Promise<{ valid: boolean, carrier?: string, type?: string }> {
    try {
      const response = await this.fetcher(
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
    const response = await this.fetcher(
      `${API_BASE}/Accounts/${this.config.accountSid}/Balance.json`,
      {
        headers: {
          Authorization: `Basic ${btoa(`${this.config.accountSid}:${this.config.authToken}`)}`,
        },
      },
    )

    if (!response.ok) {
      throw new Error(`Twilio balance API error: ${response.status}`)
    }

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

      const response = await this.fetcher(
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

      const response = await this.fetcher(
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

      const response = await this.fetcher(
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
  price?: string | null
  price_unit?: string
  date_created: string
  date_updated?: string
  error_code?: number
  error_message?: string
  message?: string
  code?: number
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

export function createTwilioDriver(config: TwilioConfig, verifyServiceSid?: string, transport?: TwilioTransportOptions): TwilioDriver {
  return new TwilioDriver(config, verifyServiceSid, transport)
}

export { TwilioDriver as default }
