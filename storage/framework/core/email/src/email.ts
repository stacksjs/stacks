import type { EmailDriver, EmailMessage, EmailResult } from '@stacksjs/types'
import { config } from '@stacksjs/config'
import type { Message } from './types'
import { MailgunDriver } from './drivers/mailgun'
import { MailtrapDriver } from './drivers/mailtrap'
import { SendGridDriver } from './drivers/sendgrid'
import { SESDriver } from './drivers/ses'
import { SMTPDriver } from './drivers/smtp'

/** Result returned by email handler callbacks */
interface EmailHandlerResult {
  message: string
}

/** Configuration for the sender address */
interface EmailFromAddress {
  name: string
  address: string
}

/** Configuration for the Mail singleton */
interface MailConfig {
  defaultDriver?: string
}

/**
 * Email notification class for defining email notifications
 */
export class Email {
  public name: string
  public subject: string
  public to: string
  public from?: EmailFromAddress
  public template: string
  public handle?: () => Promise<EmailHandlerResult>
  public onError?: (error: Error) => Promise<EmailHandlerResult>
  public onSuccess?: () => void

  constructor(options: Message) {
    this.name = options.name
    this.subject = options.subject
    this.to = options.to
    this.from = options.from
    this.template = options.template
    this.handle = options.handle
    this.onError = options.onError
    this.onSuccess = options.onSuccess
  }

  private async renderTemplate(): Promise<string> {
    if (!this.template) return ''

    try {
      // Try to load the template file from resources/views/emails
      const { path: p } = await import('@stacksjs/path')
      const templatePath = p.resourcesPath(`views/emails/${this.template}.html`)
      const file = Bun.file(templatePath)
      if (await file.exists()) {
        return await file.text()
      }
    }
    catch {
      // Template file not found, fall back to template as raw HTML
    }

    // If template looks like HTML, use it directly; otherwise wrap it
    if (this.template.includes('<')) {
      return this.template
    }
    return `<p>${this.template}</p>`
  }

  async send(to?: string): Promise<EmailHandlerResult> {
    const recipient = to || this.to
    if (!recipient) {
      throw new Error('No recipient specified for email')
    }

    try {
      // Use the mail singleton to send
      await mail.send({
        to: [recipient],
        from: this.from || {
          name: config.email.from?.name || 'Stacks',
          address: config.email.from?.address || 'no-reply@stacksjs.com',
        },
        subject: this.subject,
        html: await this.renderTemplate(),
      })

      if (this.onSuccess) {
        this.onSuccess()
      }

      if (this.handle) {
        return this.handle()
      }

      return { message: 'Email sent' }
    }
    catch (error: unknown) {
      if (this.onError) {
        return this.onError(error instanceof Error ? error : new Error(String(error)))
      }
      throw error
    }
  }
}

class Mail {
  private drivers: Map<string, EmailDriver> = new Map()
  private defaultDriver: string

  constructor(options: MailConfig = {}) {
    this.defaultDriver = options.defaultDriver || config.email.default || 'ses'
    this.registerDefaultDrivers()
  }

  private registerDefaultDrivers(): void {
    this.drivers.set('ses', new SESDriver())
    this.drivers.set('sendgrid', new SendGridDriver())
    this.drivers.set('mailgun', new MailgunDriver())
    this.drivers.set('mailtrap', new MailtrapDriver())
    this.drivers.set('smtp', new SMTPDriver())
  }

  public async send(message: EmailMessage): Promise<EmailResult> {
    const driver = this.drivers.get(this.defaultDriver)

    if (!driver)
      throw new Error(`Email driver '${this.defaultDriver}' is not available`)

    const defaultFrom: EmailFromAddress = {
      name: config.email.from?.name || 'Stacks',
      address: config.email.from?.address || 'no-reply@stacksjs.com',
    }

    return driver.send({
      ...message,
      from: message.from || defaultFrom,
    })
  }

  // Create a new Mail instance with a different driver (doesn't mutate the singleton)
  public use(driver: string): Mail {
    if (!this.drivers.has(driver)) {
      throw new Error(`Email driver '${driver}' is not available`)
    }
    const instance = new Mail({ defaultDriver: driver })
    return instance
  }

  /**
   * Queue an email for background sending via the job system.
   * Falls back to synchronous send if queue driver is 'sync'.
   */
  public async queue(message: EmailMessage): Promise<void> {
    try {
      const { job } = await import('@stacksjs/queue')
      await job('SendEmail', {
        message,
        driver: this.defaultDriver,
      })
        .onQueue('emails')
        .dispatch()
    }
    catch {
      // Queue system not available, fall back to sync send
      await this.send(message)
    }
  }

  /**
   * Queue an email for sending after a delay (in seconds).
   */
  public async later(delaySeconds: number, message: EmailMessage): Promise<void> {
    try {
      const { job } = await import('@stacksjs/queue')
      await job('SendEmail', {
        message,
        driver: this.defaultDriver,
      })
        .onQueue('emails')
        .delay(delaySeconds)
        .dispatch()
    }
    catch {
      // Queue system not available, fall back to sync send
      await this.send(message)
    }
  }

  /**
   * Queue an email on a specific named queue.
   */
  public async queueOn(queueName: string, message: EmailMessage): Promise<void> {
    try {
      const { job } = await import('@stacksjs/queue')
      await job('SendEmail', {
        message,
        driver: this.defaultDriver,
      })
        .onQueue(queueName)
        .dispatch()
    }
    catch {
      await this.send(message)
    }
  }
}

// Export a singleton instance - reads default driver from config
export const mail: Mail = new Mail({ defaultDriver: config.email.default || 'ses' })
