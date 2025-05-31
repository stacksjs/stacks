import type { EmailAddress, EmailMessage, EmailResult, MailtrapResponse } from '@stacksjs/types'
import type { RenderOptions } from '@vue-email/compiler'
import { Buffer } from 'node:buffer'
import { config } from '@stacksjs/config'
import { log } from '@stacksjs/logging'
import { template } from '../template'
import { BaseEmailDriver } from './base'

export class MailtrapDriver extends BaseEmailDriver {
  public name = 'mailtrap'
  private host: string | null = null
  private token: string | null = null
  private inboxId?: number | null = null

  private getConfig() {
    if (!this.host || !this.token || !this.inboxId) {
      this.host = config.services.mailtrap?.host ?? 'https://sandbox.api.mailtrap.io/api/send'
      this.token = config.services.mailtrap?.token ?? ''
      this.inboxId = config.services.mailtrap?.inboxId ? Number(config.services.mailtrap.inboxId) : undefined
    }

    return {
      host: this.host,
      token: this.token,
      inboxId: this.inboxId,
    }
  }

  public async send(message: EmailMessage, options?: RenderOptions): Promise<EmailResult> {
    const { inboxId } = this.getConfig()
    const logContext = {
      provider: this.name,
      to: message.to,
      subject: message.subject,
      inboxId,
    }

    log.info('Sending email via Mailtrap...', logContext)

    try {
      this.validateMessage(message)
      let templ
      if (message.template)
        templ = await template(message.template, options)

      const mailtrapPayload = {
        from: {
          email: message.from?.address || config.email.from?.address || '',
          name: message.from?.name || config.email.from?.name,
        },
        to: this.formatMailtrapAddresses(message.to),
        ...(message.cc && { cc: this.formatMailtrapAddresses(message.cc) }),
        ...(message.bcc && { bcc: this.formatMailtrapAddresses(message.bcc) }),
        subject: message.subject,
        ...(templ?.html && { html: templ.html }),
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
    const { host, token, inboxId } = this.getConfig()

    if (!inboxId) {
      throw new Error('Mailtrap inbox ID is required but not provided. Please set MAILTRAP_INBOX_ID in your environment variables.')
    }

    const endpoint = `${host}/${inboxId}`

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(`Mailtrap API error: ${response.status} - ${JSON.stringify(errorData)}`)
      }

      const data: MailtrapResponse = await (response.json() as Promise<MailtrapResponse>)

      log.info(`[${this.name}] Email sent successfully`, { attempt, messageId: data.message_ids?.[0] })
      return data
    }
    catch (error) {
      if (attempt < (config.services.mailtrap?.maxRetries ?? 3)) {
        const retryTimeout = config.services.mailtrap?.retryTimeout ?? 1000
        log.warn(`[${this.name}] Email send failed, retrying (${attempt}/${config.services.mailtrap?.maxRetries ?? 3})`)
        await new Promise(resolve => setTimeout(resolve, retryTimeout))

        return this.sendWithRetry(payload, attempt + 1)
      }
      throw error
    }
  }
}

export default MailtrapDriver
