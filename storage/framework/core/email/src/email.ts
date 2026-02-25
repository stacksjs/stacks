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
        html: `<p>Email: ${this.template}</p>`, // Placeholder - should render template
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

  // Optional method to switch drivers on the fly
  public use(driver: string): this {
    if (!this.drivers.has(driver)) {
      throw new Error(`Email driver '${driver}' is not available`)
    }
    this.defaultDriver = driver
    return this
  }
}

// Export a singleton instance - reads default driver from config
export const mail: Mail = new Mail({ defaultDriver: config.email.default || 'ses' })
