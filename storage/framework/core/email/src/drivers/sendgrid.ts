import type { EmailAddress, EmailMessage, EmailResult } from '@stacksjs/types'
import type { RenderOptions } from '@vue-email/compiler'
import { Buffer } from 'node:buffer'
import { config } from '@stacksjs/config'
import { log } from '@stacksjs/logging'
import { template } from '../template'
import { BaseEmailDriver } from './base'

export class SendGridDriver extends BaseEmailDriver {
  public name = 'sendgrid'
  private apiKey: string | null = null

  private getApiKey(): string {
    if (!this.apiKey) {
      this.apiKey = config.services.sendgrid?.apiKey ?? ''
    }
    return this.apiKey
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

      // Only attempt to render template if one is provided
      let htmlContent: string | undefined
      if (message.template) {
        const templ = await template(message.template, options)
        if (templ && 'html' in templ) {
          htmlContent = templ.html
        }
      }

      // Prepare content array based on available content
      const content = []

      // Add HTML content if available
      if (htmlContent) {
        content.push({
          type: 'text/html',
          value: htmlContent,
        })
      }

      // Add text content if available
      if (message.text) {
        content.push({
          type: 'text/plain',
          value: message.text,
        })
      }

      // If no content was added, throw an error
      if (content.length === 0) {
        throw new Error('Email must have either HTML or text content')
      }

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
          email: message.from?.address || config.email.from?.address || '',
          name: message.from?.name || config.email.from?.name,
        },
        content,
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
          'Authorization': `Bearer ${this.getApiKey()}`,
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
      if (attempt < (config.services.sendgrid?.maxRetries ?? 3)) {
        const retryTimeout = config.services.sendgrid?.retryTimeout ?? 1000
        log.warn(`[${this.name}] Email send failed, retrying (${attempt}/${config.services.sendgrid?.maxRetries ?? 3})`)
        await new Promise(resolve => setTimeout(resolve, retryTimeout))
        return this.sendWithRetry(payload, attempt + 1)
      }
      throw error
    }
  }
}

export default SendGridDriver
