import type { EmailAddress, EmailMessage, EmailResult } from '@stacksjs/types'
import type { RenderOptions } from '@vue-email/compiler'
import { Buffer } from 'node:buffer'
import { config } from '@stacksjs/config'
import { log } from '@stacksjs/logging'
import { template } from '../template'
import { BaseEmailDriver } from './base'

interface MailgunResponse {
  id: string
  message: string
}

export class MailgunDriver extends BaseEmailDriver {
  public name = 'mailgun'
  private apiKey: string | null = null
  private domain: string | null = null
  private endpoint: string | null = null

  private getConfig() {
    if (!this.apiKey || !this.domain || !this.endpoint) {
      this.apiKey = config.services.mailgun?.apiKey ?? ''
      this.domain = config.services.mailgun?.domain ?? ''
      this.endpoint = config.services.mailgun?.endpoint ?? 'api.mailgun.net'
    }
    return {
      apiKey: this.apiKey,
      domain: this.domain,
      endpoint: this.endpoint,
    }
  }

  public async send(message: EmailMessage, options?: RenderOptions): Promise<EmailResult> {
    const { domain } = this.getConfig()
    const logContext = {
      provider: this.name,
      to: message.to,
      subject: message.subject,
      domain,
    }

    log.info('Sending email via Mailgun...', logContext)

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

      const formData = new FormData()
      const fromAddress = {
        address: message.from?.address || config.email.from?.address || '',
        name: message.from?.name || config.email.from?.name,
      }
      formData.append('from', this.formatMailgunAddress(fromAddress))

      // Handle multiple recipients
      this.formatMailgunAddresses(message.to).forEach(to => formData.append('to', to))

      if (message.cc)
        this.formatMailgunAddresses(message.cc).forEach(cc => formData.append('cc', cc))

      if (message.bcc)
        this.formatMailgunAddresses(message.bcc).forEach(bcc => formData.append('bcc', bcc))

      formData.append('subject', message.subject)

      // Only append html content if it exists
      if (htmlContent) {
        formData.append('html', htmlContent)
      }

      if (message.text)
        formData.append('text', message.text)

      // Handle attachments
      if (message.attachments) {
        message.attachments.forEach((attachment) => {
          const content = typeof attachment.content === 'string'
            ? attachment.content
            : this.arrayBufferToBase64(attachment.content)

          formData.append('attachment', new Blob([content], { type: attachment.contentType }), attachment.filename)
        })
      }

      const response = await this.sendWithRetry(formData)
      return this.handleSuccess(message, response.id)
    }
    catch (error) {
      return this.handleError(error, message)
    }
  }

  private formatMailgunAddress(address: EmailAddress): string {
    return address.name ? `${address.name} <${address.address}>` : address.address
  }

  private formatMailgunAddresses(addresses: string | string[] | EmailAddress[] | undefined): string[] {
    if (!addresses)
      return []

    if (typeof addresses === 'string')
      return [addresses]

    return addresses.map((addr) => {
      if (typeof addr === 'string')
        return addr
      return addr.name ? `${addr.name} <${addr.address}>` : addr.address
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

  private async sendWithRetry(formData: FormData, attempt = 1): Promise<MailgunResponse> {
    const { apiKey, domain, endpoint } = this.getConfig()
    const url = `https://${endpoint}/v3/${domain}/messages`
    const auth = Buffer.from(`api:${apiKey}`).toString('base64')

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
        },
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(`Mailgun API error: ${response.status} - ${JSON.stringify(errorData)}`)
      }

      const data = await response.json() as MailgunResponse
      log.info(`[${this.name}] Email sent successfully`, { attempt, messageId: data.id })
      return data
    }
    catch (error) {
      if (attempt < (config.services.mailgun?.maxRetries ?? 3)) {
        const retryTimeout = config.services.mailgun?.retryTimeout ?? 1000
        log.warn(`[${this.name}] Email send failed, retrying (${attempt}/${config.services.mailgun?.maxRetries ?? 3})`)
        await new Promise(resolve => setTimeout(resolve, retryTimeout))
        return this.sendWithRetry(formData, attempt + 1)
      }
      throw error
    }
  }
}

export default MailgunDriver
