import type { EmailDriver, EmailMessage, EmailResult } from '@stacksjs/types'
import { config } from '@stacksjs/config'
import { MailgunDriver } from './drivers/mailgun'
import { MailtrapDriver } from './drivers/mailtrap'
import { SendGridDriver } from './drivers/sendgrid'
import { SESDriver } from './drivers/ses'

class Mail {
  private drivers: Map<string, EmailDriver> = new Map()
  private defaultDriver: string

  constructor(options: { defaultDriver?: string } = {}) {
    this.defaultDriver = options.defaultDriver || config.email.default || 'ses'
    this.registerDefaultDrivers()
  }

  private registerDefaultDrivers(): void {
    this.drivers.set('ses', new SESDriver())
    this.drivers.set('sendgrid', new SendGridDriver())
    this.drivers.set('mailgun', new MailgunDriver())
    this.drivers.set('mailtrap', new MailtrapDriver())
  }

  public async send(message: EmailMessage): Promise<EmailResult> {
    const driver = this.drivers.get(this.defaultDriver)

    if (!driver)
      throw new Error(`Email driver '${this.defaultDriver}' is not available`)

    const defaultFrom = {
      name: config.email.from?.name || 'Stacks',
      address: config.email.from?.address || 'no-reply@stacksjs.org',
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

// Export a singleton instance
export const mail: Mail = new Mail({ defaultDriver: 'mailtrap' })
