import type { EmailAddress, EmailDriver, EmailDriverConfig, EmailMessage, EmailResult, RenderOptions } from '@stacksjs/types'
import { log } from '@stacksjs/logging'

export abstract class BaseEmailDriver implements EmailDriver {
  public abstract name: string
  protected config: Required<EmailDriverConfig>

  constructor(config?: EmailDriverConfig) {
    this.config = {
      maxRetries: config?.maxRetries || 3,
      retryTimeout: config?.retryTimeout || 1000,
      ...config,
    }
  }

  public configure(config: EmailDriverConfig): void {
    this.config = { ...this.config, ...config }
  }

  public abstract send(message: EmailMessage, options?: RenderOptions): Promise<EmailResult>

  /**
   * Validates email message fields
   */
  protected validateMessage(message: EmailMessage): boolean {
    if (!message.from?.address && !this.config.email.from?.address) {
      throw new Error('Email sender address is required either in message or config')
    }

    if (!message.to || (Array.isArray(message.to) && message.to.length === 0)) {
      throw new Error('At least one recipient is required')
    }

    if (!message.subject) {
      throw new Error('Email subject is required')
    }

    return true
  }

  /**
   * Formats email addresses to standard format
   */
  protected formatAddresses(addresses: string | string[] | EmailAddress[] | undefined): string[] {
    if (!addresses)
      return []

    if (typeof addresses === 'string') {
      return [addresses]
    }

    return addresses.map((addr) => {
      if (typeof addr === 'string')
        return addr
      return addr.name ? `${addr.name} <${addr.address}>` : addr.address
    })
  }

  /**
   * Error handler with standard formatting
   */
  protected async handleError(error: unknown, message: EmailMessage): Promise<EmailResult> {
    const err = error instanceof Error ? error : new Error(String(error))

    log.error(`[${this.name}] Email sending failed`, {
      error: err.message,
      stack: err.stack,
      to: message.to,
      subject: message.subject,
    })

    let result: EmailResult = {
      message: `Email sending failed: ${err.message}`,
      success: false,
      provider: this.name,
    }

    if (message.onError) {
      const customResult = message.onError(err)
      const handlerResult = customResult instanceof Promise
        ? await customResult
        : customResult

      result = {
        ...result,
        ...handlerResult,
        success: false,
        provider: this.name,
      }
    }

    return result
  }

  /**
   * Success handler with standard formatting
   */
  protected async handleSuccess(message: EmailMessage, messageId?: string): Promise<EmailResult> {
    let result: EmailResult = {
      message: 'Email sent successfully',
      success: true,
      provider: this.name,
      messageId,
    }

    try {
      if (message.handle) {
        const customResult = message.handle()
        const handlerResult = customResult instanceof Promise
          ? await customResult
          : customResult

        result = {
          ...result,
          ...handlerResult,
          success: true,
          provider: this.name,
          messageId,
        }
      }

      if (message.onSuccess) {
        const successResult = message.onSuccess()
        const handlerResult = successResult instanceof Promise
          ? await successResult
          : successResult

        result = {
          ...result,
          ...handlerResult,
          success: true,
          provider: this.name,
          messageId,
        }
      }
    }
    catch (error) {
      return this.handleError(error, message)
    }

    return result
  }
}
