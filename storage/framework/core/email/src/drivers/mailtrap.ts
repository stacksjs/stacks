import type { EmailAddress, EmailMessage, EmailResult, MailtrapConfig, RenderOptions } from '@stacksjs/types'
import { Buffer } from 'node:buffer'
import { log } from '@stacksjs/logging'
import { template } from '../template'
import { BaseEmailDriver } from './base'

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
