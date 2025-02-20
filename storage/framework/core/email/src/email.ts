// Core interfaces and types
import type { RenderOptions } from './template'
// Amazon SES implementation
import { log } from '@stacksjs/logging'

import { template } from './template'

export class SendGridDriver extends BaseEmailDriver {
  public name = 'sendgrid'
  private apiKey: string

  constructor(config: SendGridConfig) {
    super(config)
    this.apiKey = config.apiKey
  }

  public async send(message: EmailMessage, options?: RenderOptions): Promise<EmailResult> {
    const logContext = {
      provider: this.name,
      to: message.to,
      subject: message.subject,
    }

    log.info('Sending email via SendGrid...', logContext)

    try {
      this.validateMessage(message)
      const templ = await template(message.template, options)

      // Convert our message format to SendGrid format
      const sendgridPayload = {
        personalizations: [
          {
            to: this.formatSendGridAddresses(message.to),
            ...(message.cc && { cc: this.formatSendGridAddresses(message.cc) }),
            ...(message.bcc && { bcc: this.formatSendGridAddresses(message.bcc) }),
            subject: message.subject,
          },
        ],
        from: {
          email: message.from.address,
          ...(message.from.name && { name: message.from.name }),
        },
        content: [
          {
            type: 'text/html',
            value: templ.html,
          },
        ],
        ...(message.text && {
          content: [
            {
              type: 'text/html',
              value: templ.html,
            },
            {
              type: 'text/plain',
              value: message.text,
            },
          ],
        }),
        ...(message.attachments && {
          attachments: message.attachments.map(attachment => ({
            filename: attachment.filename,
            content: typeof attachment.content === 'string'
              ? attachment.content
              : this.arrayBufferToBase64(attachment.content),
            type: attachment.contentType,
            disposition: 'attachment',
          })),
        }),
      }

      const response = await this.sendWithRetry(sendgridPayload)
      return this.handleSuccess(message, response.headers?.['x-message-id'])
    }
    catch (error) {
      return this.handleError(error, message)
    }
  }

  private formatSendGridAddresses(addresses: string | string[] | EmailAddress[] | undefined): Array<{ email: string, name?: string }> {
    if (!addresses)
      return []

    if (typeof addresses === 'string') {
      return [{ email: addresses }]
    }

    return addresses.map((addr) => {
      if (typeof addr === 'string')
        return { email: addr }
      return { email: addr.address, ...(addr.name && { name: addr.name }) }
    })
  }

  private arrayBufferToBase64(buffer: Uint8Array): string {
    let binary = ''
    const bytes = new Uint8Array(buffer)
    const len = bytes.byteLength

    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i])
    }

    return typeof btoa === 'function'
      ? btoa(binary)
      : Buffer.from(binary).toString('base64')
  }

  private async sendWithRetry(payload: any, attempt = 1): Promise<any> {
    try {
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(`SendGrid API error: ${response.status} - ${JSON.stringify(errorData)}`)
      }

      log.info(`[${this.name}] Email sent successfully`, { attempt })
      return response
    }
    catch (error) {
      if (attempt < this.config.maxRetries) {
        log.warn(`[${this.name}] Email send failed, retrying (${attempt}/${this.config.maxRetries})`, { error })
        await new Promise(resolve => setTimeout(resolve, this.config.retryTimeout))
        return this.sendWithRetry(payload, attempt + 1)
      }
      throw error
    }
  }
}

// Mailtrap implementation

export class MailtrapDriver extends BaseEmailDriver {
  public name = 'mailtrap'
  private token: string
  private inboxId?: number

  constructor(config: MailtrapConfig) {
    super(config)
    this.token = config.token
    this.inboxId = config.inboxId
  }

  public async send(message: EmailMessage, options?: RenderOptions): Promise<EmailResult> {
    const logContext = {
      provider: this.name,
      to: message.to,
      subject: message.subject,
      inboxId: this.inboxId,
    }

    log.info('Sending email via Mailtrap...', logContext)

    try {
      this.validateMessage(message)
      const templ = await template(message.template, options)

      // Convert to Mailtrap format
      const mailtrapPayload = {
        from: {
          email: message.from.address,
          ...(message.from.name && { name: message.from.name }),
        },
        to: this.formatMailtrapAddresses(message.to),
        ...(message.cc && { cc: this.formatMailtrapAddresses(message.cc) }),
        ...(message.bcc && { bcc: this.formatMailtrapAddresses(message.bcc) }),
        subject: message.subject,
        html: templ.html,
        ...(message.text && { text: message.text }),
        ...(message.attachments && {
          attachments: message.attachments.map(attachment => ({
            filename: attachment.filename,
            content: typeof attachment.content === 'string'
              ? attachment.content
              : this.arrayBufferToBase64(attachment.content),
            type: attachment.contentType || 'application/octet-stream',
          })),
        }),
      }

      const response = await this.sendWithRetry(mailtrapPayload)
      return this.handleSuccess(message, response.message_ids?.[0])
    }
    catch (error) {
      return this.handleError(error, message)
    }
  }

  private formatMailtrapAddresses(addresses: string | string[] | EmailAddress[] | undefined): Array<{ email: string, name?: string }> {
    if (!addresses)
      return []

    if (typeof addresses === 'string') {
      return [{ email: addresses }]
    }

    return addresses.map((addr) => {
      if (typeof addr === 'string')
        return { email: addr }
      return { email: addr.address, ...(addr.name && { name: addr.name }) }
    })
  }

  private arrayBufferToBase64(buffer: Uint8Array): string {
    let binary = ''
    const bytes = new Uint8Array(buffer)
    const len = bytes.byteLength

    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i])
    }

    return typeof btoa === 'function'
      ? btoa(binary)
      : Buffer.from(binary).toString('base64')
  }

  private async sendWithRetry(payload: any, attempt = 1): Promise<any> {
    const endpoint = this.inboxId
      ? `https://send.api.mailtrap.io/api/send/${this.inboxId}`
      : 'https://send.api.mailtrap.io/api/send'

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(`Mailtrap API error: ${response.status} - ${JSON.stringify(errorData)}`)
      }

      const data = await response.json()
      log.info(`[${this.name}] Email sent successfully`, { attempt, messageId: data.message_ids?.[0] })
      return data
    }
    catch (error) {
      if (attempt < this.config.maxRetries) {
        log.warn(`[${this.name}] Email send failed, retrying (${attempt}/${this.config.maxRetries})`)
        await new Promise(resolve => setTimeout(resolve, this.config.retryTimeout))
        return this.sendWithRetry(payload, attempt + 1)
      }
      throw error
    }
  }
}

// Main EmailService class
export class EmailService {
  private drivers: Map<string, EmailDriver> = new Map()
  private defaultDriver: string

  constructor(defaultDriver: string = 'ses') {
    this.defaultDriver = defaultDriver
  }

  /**
   * Register a new email driver
   */
  public registerDriver(driver: EmailDriver): this {
    this.drivers.set(driver.name, driver)
    return this
  }

  /**
   * Set the default driver
   */
  public setDefaultDriver(name: string): this {
    if (!this.drivers.has(name)) {
      throw new Error(`Email driver '${name}' is not registered`)
    }
    this.defaultDriver = name
    return this
  }

  /**
   * Get a specific driver instance
   */
  public driver(name?: string): EmailDriver {
    const driverName = name || this.defaultDriver
    const driver = this.drivers.get(driverName)

    if (!driver) {
      throw new Error(`Email driver '${driverName}' is not registered`)
    }

    return driver
  }

  /**
   * Send an email using the default or specified driver
   */
  public async send(
    message: EmailMessage,
    options?: { driver?: string, renderOptions?: RenderOptions },
  ): Promise<EmailResult> {
    const driver = this.driver(options?.driver)
    return driver.send(message, options?.renderOptions)
  }

  /**
   * Create a new pre-configured email service
   */
  public static create(config: {
    defaultDriver?: string
    ses?: SESConfig
    sendgrid?: SendGridConfig
    mailtrap?: MailtrapConfig
    [key: string]: any
  }): EmailService {
    const service = new EmailService(config.defaultDriver)

    if (config.ses) {
      service.registerDriver(new SESDriver(config.ses))
    }

    if (config.sendgrid) {
      service.registerDriver(new SendGridDriver(config.sendgrid))
    }

    if (config.mailtrap) {
      service.registerDriver(new MailtrapDriver(config.mailtrap))
    }

    return service
  }
}

// Factory function to create an email message
export const createMessage = (message: EmailMessage): EmailMessage => message

// Factory function to create an email service
export const createEmailService = EmailService.create

export default EmailService
