import type { EmailAddress, EmailDriver, EmailDriverConfig, EmailMessage, EmailResult } from '@stacksjs/types'
import type { TemplateOptions } from '../template'
import { config as appConfig } from '@stacksjs/config'
import { log } from '@stacksjs/logging'
import { assertEnvelopeAddress, assertHeaderSafeSubject, assertHeaderValue } from '../validation'

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

  public abstract send(message: EmailMessage, options?: TemplateOptions): Promise<EmailResult>

  /**
   * Validates email message fields.
   *
   * Includes structural address validation — `to`/`cc`/`bcc`/`from` are
   * checked against a regex that rejects whitespace, control chars, and
   * the angle-bracket-comma-quote characters that SMTP relays misparse.
   * The previous version accepted "" / "user" / "victim@x\r\nBCC:y@x"
   * and surfaced the resulting failure deep in the SMTP transaction.
   */
  protected validateMessage(message: EmailMessage): boolean {
    if (!message.from?.address && !appConfig.email.from?.address) {
      throw new Error('Email sender address is required either in message or config')
    }

    if (!message.to || (Array.isArray(message.to) && message.to.length === 0)) {
      throw new Error('At least one recipient is required')
    }

    if (!message.subject) {
      throw new Error('Email subject is required')
    }

    // Subject CRLF guard (stacksjs/stacks#1871 M-6) — the subject is a
    // header field on the wire; a CR/LF in the value lets an attacker
    // inject additional headers. Pulled into a shared helper so every
    // driver gets the same check.
    assertHeaderSafeSubject(message.subject)

    const checkAddresses = (value: unknown, role: string): void => {
      if (value === undefined || value === null) return
      if (Array.isArray(value)) {
        for (const item of value) checkAddresses(item, role)
      }
      else if (typeof value === 'string') {
        assertEnvelopeAddress(value, role)
      }
      else {
        const address = value as EmailAddress
        assertEnvelopeAddress(address.address, role)
        if (address.name !== undefined) assertHeaderValue(address.name, `${role} name`)
      }
    }
    checkAddresses(message.from ?? appConfig.email.from, 'from')
    checkAddresses(message.to, 'to')
    checkAddresses(message.cc, 'cc')
    checkAddresses(message.bcc, 'bcc')
    checkAddresses(message.replyTo, 'replyTo')

    return true
  }

  /**
   * Formats email addresses to standard format.
   *
   * Display names that contain quotes, commas, parentheses, brackets, or
   * angle brackets violate RFC 5322 unless wrapped in double quotes —
   * otherwise SMTP servers may misparse "Smith, John <j@x.com>" as two
   * recipients ("Smith" and "John <j@x.com>"). Quote-wrap any name that
   * contains a special character.
   */
  protected formatAddresses(addresses: string | string[] | EmailAddress[] | undefined): string[] {
    if (!addresses)
      return []

    if (typeof addresses === 'string') {
      return [addresses]
    }

    return addresses.map((_addr) => {
      if (typeof _addr === 'string')
        return _addr
      if (!_addr.name) return _addr.address
      const needsQuoting = /[",()<>[\]:;@\\]/.test(_addr.name)
      const safeName = needsQuoting
        ? `"${_addr.name.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
        : _addr.name
      return `${safeName} <${_addr.address}>`
    })
  }

  /**
   * Same as {@link formatAddresses}, but also accepts a single bare
   * `EmailAddress` or single string. Used by drivers that need to
   * pipe `message.replyTo` through the standard formatter — the
   * replyTo slot accepts a single instance OR an array, while
   * `formatAddresses` expects array-or-string input.
   * (stacksjs/stacks#1871 M-4.)
   */
  protected formatAddressList(value: string | string[] | EmailAddress | EmailAddress[] | undefined): string[] {
    if (!value) return []
    if (Array.isArray(value)) return this.formatAddresses(value as string[] | EmailAddress[])
    if (typeof value === 'string') return this.formatAddresses(value)
    // Single EmailAddress
    return this.formatAddresses([value])
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
