import type { RenderOptions } from './template'
import { SendEmailCommand, SES } from '@aws-sdk/client-ses'
import { log } from '@stacksjs/logging'
import { template } from './template'

export interface EmailAddress {
  address: string
  name?: string
}

export interface EmailMessage {
  /** Required sender email address */
  from: EmailAddress
  /** Primary recipient(s) */
  to: string | string[] | EmailAddress[]
  /** Carbon copy recipient(s) */
  cc?: string | string[] | EmailAddress[]
  /** Blind carbon copy recipient(s) */
  bcc?: string | string[] | EmailAddress[]
  /** Email subject line */
  subject: string
  /** Path to email template */
  template: string
  /** Optional plain text fallback */
  text?: string
  /** Optional attachments */
  attachments?: Array<{
    filename: string
    content: string | Uint8Array
    contentType?: string
    encoding?: 'base64' | 'binary' | 'hex' | 'utf8'
  }>
  /** Optional callback after successful delivery */
  onSuccess?: () => Promise<{ message: string }> | { message: string }
  /** Optional callback after failed delivery */
  onError?: (error: Error) => Promise<{ message: string }> | { message: string }
  /** Optional custom handler */
  handle?: () => Promise<{ message: string }> | { message: string }
}

export interface EmailConfig {
  /** AWS region for SES */
  region?: string
  /** Maximum retry attempts */
  maxRetries?: number
  /** Retry timeout in milliseconds */
  retryTimeout?: number
}

export class Email {
  private client: SES
  private config: Required<EmailConfig>

  constructor(
    private message: EmailMessage,
    config?: EmailConfig,
  ) {
    this.config = {
      region: config?.region || 'us-east-1',
      maxRetries: config?.maxRetries || 3,
      retryTimeout: config?.retryTimeout || 1000,
    }

    this.client = new SES({ region: this.config.region })
    this.message = message
  }

  /**
   * Validates that the email message has all required fields
   * @returns True if valid, throws Error if invalid
   */
  private validateMessage(): boolean {
    if (!this.message.from?.address) {
      throw new Error('Email sender address is required')
    }

    if (!this.message.to || (Array.isArray(this.message.to) && this.message.to.length === 0)) {
      throw new Error('At least one recipient is required')
    }

    if (!this.message.subject) {
      throw new Error('Email subject is required')
    }

    if (!this.message.template) {
      throw new Error('Email template path is required')
    }

    return true
  }

  /**
   * Formats email addresses for AWS SES
   */
  private formatAddresses(addresses: string | string[] | EmailAddress[] | undefined): string[] {
    if (!addresses)
      return []

    if (typeof addresses === 'string') {
      return [addresses]
    }

    return addresses.map(addr => {
      if (typeof addr === 'string')
        return addr
      return addr.name ? `${addr.name} <${addr.address}>` : addr.address
    })
  }

  /**
   * Sends an email with optional template rendering
   */
  public async send(options?: RenderOptions): Promise<{ message: string }> {
    const logContext = {
      to: this.message.to,
      subject: this.message.subject,
      template: this.message.template,
    }

    log.info('Sending email...', logContext)

    try {
      // Validate message before proceeding
      this.validateMessage()

      // Render template
      const templ = await template(this.message.template, options)

      const params = {
        Source: this.message.from.name
          ? `${this.message.from.name} <${this.message.from.address}>`
          : this.message.from.address,

        Destination: {
          ToAddresses: this.formatAddresses(this.message.to),
          CcAddresses: this.formatAddresses(this.message.cc),
          BccAddresses: this.formatAddresses(this.message.bcc),
        },

        Message: {
          Body: {
            Html: {
              Charset: 'UTF-8',
              Data: templ.html,
            },
            ...(this.message.text && {
              Text: {
                Charset: 'UTF-8',
                Data: this.message.text,
              },
            }),
          },
          Subject: {
            Charset: 'UTF-8',
            Data: this.message.subject,
          },
        },
      }

      // Send email with retries
      await this.sendWithRetry(params)

      // Handle custom callback if provided
      let returnMsg: { message: string } = { message: 'Email sent successfully' }
      if (this.message.handle) {
        const result = this.message.handle()
        returnMsg = result instanceof Promise ? await result : result
      }

      // Handle success callback
      await this.onSuccess()
      return returnMsg
    }
    catch (error) {
      return this.onError(error instanceof Error ? error : new Error(String(error)))
    }
  }

  /**
   * Attempts to send email with configurable retries
   */
  private async sendWithRetry(params: any, attempt = 1): Promise<void> {
    try {
      const command = new SendEmailCommand(params)
      await this.client.send(command)
      log.info(`Email sent successfully`, { attempt })
    }
    catch (error) {
      if (attempt < this.config.maxRetries) {
        log.warn(`Email send failed, retrying (${attempt}/${this.config.maxRetries})`)
        await new Promise(resolve => setTimeout(resolve, this.config.retryTimeout))
        return this.sendWithRetry(params, attempt + 1)
      }
      throw error
    }
  }

  /**
   * Handles errors during email sending
   */
  public async onError(error: Error): Promise<{ message: string }> {
    log.error('Email sending failed', { error: error.message, stack: error.stack })

    if (!this.message.onError) {
      return { message: `Email sending failed: ${error.message}` }
    }

    const result = this.message.onError(error)
    return result instanceof Promise ? await result : result
  }

  /**
   * Handles successful email delivery
   */
  public async onSuccess(): Promise<{ message: string }> {
    try {
      if (!this.message.onSuccess) {
        return { message: 'Email sent successfully' }
      }

      const result = this.message.onSuccess()
      return result instanceof Promise ? await result : result
    }
    catch (error) {
      return this.onError(error instanceof Error ? error : new Error(String(error)))
    }
  }
}
