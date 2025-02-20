// Core interfaces and types
import type { EmailDriver, EmailMessage, EmailResult, MailtrapConfig, RenderOptions, SendGridConfig, SESConfig } from '@stacksjs/types'
import { MailtrapDriver } from './drivers/mailtrap'
import { SendGridDriver } from './drivers/sendgrid'
import { SESDriver } from './drivers/ses'

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

export default EmailService
