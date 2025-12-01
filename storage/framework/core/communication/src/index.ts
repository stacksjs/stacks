/**
 * Unified Communication SDK for Stacks
 *
 * Provides a unified interface for email, phone, and SMS communication
 */

import { EmailSDK, type EmailMessage, type SendResult as EmailSendResult } from '../../email/src/sdk'

export interface NotificationOptions {
  message: string
  subject?: string
  channels: ('email' | 'sms' | 'phone')[]
  priority?: 'low' | 'normal' | 'high'
  data?: Record<string, any>
}

export interface User {
  email?: string
  phone?: string
  name?: string
  preferences?: {
    channels?: ('email' | 'sms' | 'phone')[]
    quietHours?: { start: string; end: string }
  }
}

export interface SmsSendOptions {
  to: string
  body: string
  template?: string
  templateData?: Record<string, any>
  messageType?: 'TRANSACTIONAL' | 'PROMOTIONAL'
}

export interface SmsSendResult {
  success: boolean
  messageId?: string
  status?: string
  error?: string
}

export interface NotifyResult {
  success: boolean
  results: {
    channel: string
    success: boolean
    messageId?: string
    error?: string
  }[]
}

/**
 * SMS SDK class
 */
export class SmsSDK {
  private region: string
  private appId?: string

  constructor(options?: { region?: string; appId?: string }) {
    this.region = options?.region || process.env.AWS_REGION || 'us-east-1'
    this.appId = options?.appId
  }

  /**
   * Send an SMS message
   */
  async send(options: SmsSendOptions): Promise<SmsSendResult> {
    try {
      const { PinpointClient } = await import('ts-cloud/aws')
      const pinpoint = new PinpointClient(this.region)

      // Get app ID if not provided
      let appId = this.appId
      if (!appId) {
        const appName = (process.env.APP_NAME || 'stacks').toLowerCase().replace(/[^a-z0-9-]/g, '-')
        const apps = await pinpoint.listApps({ PageSize: 100 })
        const app = apps.Item?.find((a: any) => a.Name === `${appName}-sms`)
        appId = app?.Id
      }

      if (!appId) {
        return {
          success: false,
          error: 'SMS service not configured. Run `buddy deploy` with SMS enabled.',
        }
      }

      // Resolve template if provided
      let messageBody = options.body
      if (options.template && options.templateData) {
        messageBody = this.renderTemplate(options.template, options.templateData)
      }

      const result = await pinpoint.sendSms({
        ApplicationId: appId,
        PhoneNumber: options.to,
        Message: messageBody,
        MessageType: options.messageType || 'TRANSACTIONAL',
      })

      return {
        success: result.DeliveryStatus === 'SUCCESSFUL',
        messageId: result.MessageId,
        status: result.DeliveryStatus,
      }
    }
    catch (error: any) {
      return {
        success: false,
        error: error.message,
      }
    }
  }

  /**
   * Send a templated SMS
   */
  async sendTemplate(options: {
    to: string
    template: string
    data: Record<string, any>
    messageType?: 'TRANSACTIONAL' | 'PROMOTIONAL'
  }): Promise<SmsSendResult> {
    return this.send({
      to: options.to,
      body: this.renderTemplate(options.template, options.data),
      messageType: options.messageType,
    })
  }

  /**
   * Send bulk SMS messages
   */
  async sendBulk(messages: SmsSendOptions[]): Promise<SmsSendResult[]> {
    return Promise.all(messages.map(msg => this.send(msg)))
  }

  private renderTemplate(template: string, data: Record<string, any>): string {
    let result = template
    for (const [key, value] of Object.entries(data)) {
      result = result.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), String(value))
    }
    return result
  }
}

/**
 * Unified Communication class
 */
export class Communication {
  public email: EmailSDK
  public sms: SmsSDK

  constructor(options?: { region?: string }) {
    this.email = new EmailSDK({ region: options?.region })
    this.sms = new SmsSDK({ region: options?.region })
  }

  /**
   * Send a notification to a user via their preferred channels
   */
  async notify(user: User, options: NotificationOptions): Promise<NotifyResult> {
    const results: NotifyResult['results'] = []

    // Determine which channels to use
    let channels = options.channels
    if (user.preferences?.channels) {
      channels = channels.filter(c => user.preferences!.channels!.includes(c))
    }

    // Check quiet hours
    if (user.preferences?.quietHours && options.priority !== 'high') {
      const now = new Date()
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
      const { start, end } = user.preferences.quietHours

      if (currentTime >= start && currentTime <= end) {
        // During quiet hours, only send high priority
        return {
          success: false,
          results: [{ channel: 'all', success: false, error: 'User is in quiet hours' }],
        }
      }
    }

    // Send via each channel
    for (const channel of channels) {
      try {
        if (channel === 'email' && user.email) {
          const emailResult = await this.email.send({
            to: user.email,
            subject: options.subject || 'Notification',
            html: `<p>${options.message}</p>`,
            text: options.message,
          })

          results.push({
            channel: 'email',
            success: emailResult.success,
            messageId: emailResult.messageId,
            error: emailResult.error,
          })
        }
        else if (channel === 'sms' && user.phone) {
          const smsResult = await this.sms.send({
            to: user.phone,
            body: options.message,
          })

          results.push({
            channel: 'sms',
            success: smsResult.success,
            messageId: smsResult.messageId,
            error: smsResult.error,
          })
        }
        else if (channel === 'phone' && user.phone) {
          // Phone calls would require Amazon Connect integration
          // For now, fall back to SMS
          const smsResult = await this.sms.send({
            to: user.phone,
            body: `[URGENT] ${options.message}`,
            messageType: 'TRANSACTIONAL',
          })

          results.push({
            channel: 'phone',
            success: smsResult.success,
            messageId: smsResult.messageId,
            error: smsResult.error || 'Phone calls not yet implemented, sent SMS instead',
          })
        }
      }
      catch (error: any) {
        results.push({
          channel,
          success: false,
          error: error.message,
        })
      }
    }

    return {
      success: results.some(r => r.success),
      results,
    }
  }

  /**
   * Send via the best available channel
   */
  async sendBestChannel(user: User, message: string, options?: { subject?: string }): Promise<NotifyResult> {
    // Priority: email > sms > phone
    const channels: ('email' | 'sms' | 'phone')[] = []

    if (user.email) channels.push('email')
    if (user.phone) channels.push('sms')

    if (channels.length === 0) {
      return {
        success: false,
        results: [{ channel: 'none', success: false, error: 'No contact method available' }],
      }
    }

    // Try first channel, fall back to others
    for (const channel of channels) {
      const result = await this.notify(user, {
        message,
        subject: options?.subject,
        channels: [channel],
      })

      if (result.success) {
        return result
      }
    }

    return {
      success: false,
      results: [{ channel: 'all', success: false, error: 'All channels failed' }],
    }
  }
}

// Export singleton instance
export const communication = new Communication()

// Export convenience functions
export const notify = (user: User, options: NotificationOptions) => communication.notify(user, options)
export const sendEmail = (message: EmailMessage) => communication.email.send(message)
export const sendSms = (options: SmsSendOptions) => communication.sms.send(options)

// Re-export types
export type { EmailMessage, EmailSendResult }

export default Communication
