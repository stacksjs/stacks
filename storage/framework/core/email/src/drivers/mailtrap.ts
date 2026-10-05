import type { EmailAddress, EmailMessage, EmailResult, MailtrapResponse } from '@stacksjs/types'
import { Buffer } from 'node:buffer'
import { config } from '@stacksjs/config'
import { log } from '@stacksjs/logging'
import type { TemplateOptions } from '../template'
import { templateByName } from '../template'
import { filterStringHeaders } from '../validation'
import { BaseEmailDriver } from './base'

/** Mailtrap's Email Sending API: real delivery, no inbox in the path. */
export const MAILTRAP_SENDING_URL = 'https://send.api.mailtrap.io/api/send'

/** Mailtrap's Email Testing (sandbox) API: captures into an inbox, delivers nothing. */
export const MAILTRAP_SANDBOX_URL = 'https://sandbox.api.mailtrap.io/api/send'

/** A config value, with blank meaning unset: `config/services.ts` writes `''` for a missing env var. */
function present(value: unknown): string | undefined {
  const text = value == null ? '' : String(value).trim()
  return text ? text : undefined
}

/**
 * Where a send goes.
 *
 * Mailtrap has two APIs that differ in exactly this: the sandbox captures
 * mail into a testing inbox and needs that inbox's id in the path, the
 * Sending API delivers it and takes no inbox at all. The driver used to
 * default to the sandbox and require an inbox id, so an app that configured
 * Mailtrap for production could not send through it, and one that left
 * `MAILTRAP_HOST` unset did not get the default either: `config/services.ts`
 * sets it to `''`, which `??` keeps, and the request went to `/<inbox id>`.
 *
 * So the inbox id decides: with one, the sandbox inbox; without one, real
 * delivery. `MAILTRAP_HOST` still overrides the host either way (a bulk
 * stream, a proxy).
 */
export function mailtrapEndpoint(options: { host?: unknown, inboxId?: unknown }): string {
  const host = present(options.host)?.replace(/\/+$/, '')
  const inboxId = present(options.inboxId)

  if (inboxId)
    return `${host ?? MAILTRAP_SANDBOX_URL}/${encodeURIComponent(inboxId)}`

  if (host && /sandbox\.api\.mailtrap\.io/i.test(host))
    throw new Error('MAILTRAP_HOST points at the Mailtrap sandbox, which needs MAILTRAP_INBOX_ID. Set the inbox id to capture mail for testing, or unset MAILTRAP_HOST to deliver it.')

  return host ?? MAILTRAP_SENDING_URL
}

export class MailtrapDriver extends BaseEmailDriver {
  public name = 'mailtrap'

  /** Read per send, so a value from the app's config/services.ts is never shadowed by a default read earlier. */
  private getConfig(): { endpoint: string, token: string, inboxId?: string } {
    const mailtrap = config.services.mailtrap
    const token = present(mailtrap?.token)
    if (!token)
      throw new Error('Mailtrap API token is required but not provided. Please set MAILTRAP_TOKEN in your environment variables.')

    return {
      endpoint: mailtrapEndpoint({ host: mailtrap?.host, inboxId: mailtrap?.inboxId }),
      token,
      inboxId: present(mailtrap?.inboxId),
    }
  }

  public async send(message: EmailMessage, options?: TemplateOptions): Promise<EmailResult> {
    const inboxId = present(config.services.mailtrap?.inboxId)
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
        templ = await templateByName(message.template, options)

      // Use template HTML if available, otherwise use direct HTML from message
      const htmlContent = templ?.html || message.html

      // Mailtrap's REST surface accepts a single reply_to object
      // (stacksjs/stacks#1871 M-4) and arbitrary outgoing headers via
      // a `headers` map (stacksjs/stacks#1871 M-5). Multi-replyTo
      // callers get the first entry — Mailtrap doesn't model arrays here.
      const replyTo = this.firstMailtrapAddress(message.replyTo)
      const customHeaders = filterStringHeaders(message.headers)

      const mailtrapPayload = {
        from: {
          email: message.from?.address || config.email.from?.address || '',
          name: message.from?.name || config.email.from?.name,
        },
        to: this.formatMailtrapAddresses(message.to),
        ...(message.cc && { cc: this.formatMailtrapAddresses(message.cc) }),
        ...(message.bcc && { bcc: this.formatMailtrapAddresses(message.bcc) }),
        ...(replyTo ? { reply_to: replyTo } : {}),
        ...(customHeaders ? { headers: customHeaders } : {}),
        subject: message.subject,
        ...(htmlContent && { html: htmlContent }),
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

  /**
   * Extract the first Mailtrap-shape `{ email, name? }` from a single
   * or array reply-to value. Mailtrap's API only accepts one reply_to;
   * multi-address callers get the first entry. (stacksjs/stacks#1871 M-4.)
   */
  private firstMailtrapAddress(value: EmailMessage['replyTo']): { email: string, name?: string } | undefined {
    if (!value) return undefined
    if (typeof value === 'string') return { email: value }
    if (Array.isArray(value)) {
      const first = value[0]
      if (first === undefined) return undefined
      if (typeof first === 'string') return { email: first }
      return { email: first.address, ...(first.name && { name: first.name }) }
    }
    return { email: value.address, ...(value.name && { name: value.name }) }
  }

  private arrayBufferToBase64(buffer: Uint8Array): string {
    let binary = ''
    const bytes = new Uint8Array(buffer)
    const len = bytes.byteLength

    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i] ?? 0)
    }

    return typeof btoa === 'function'
      ? btoa(binary)
      : Buffer.from(binary).toString('base64')
  }

  private async sendWithRetry(payload: Record<string, unknown>, attempt = 1): Promise<MailtrapResponse> {
    const { endpoint, token } = this.getConfig()

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
        const errorData = await response.json().catch(() => ({}))
        const err = new Error(`Mailtrap API error: ${response.status} - ${JSON.stringify(errorData)}`) as Error & { status?: number }
        err.status = response.status
        throw err
      }

      const data: MailtrapResponse = await (response.json() as Promise<MailtrapResponse>)

      log.info(`[${this.name}] Email sent successfully`, { attempt, messageId: data.message_ids?.[0] })
      return data
    }
    catch (error: unknown) {
      // The same rule as the SendGrid driver: a 4xx other than 429 is the
      // request or the token being wrong, and resending it only spends the
      // retry budget on an answer that will not change.
      const status = (error as { status?: number })?.status
      const nonRetryable = typeof status === 'number' && status >= 400 && status < 500 && status !== 429
      const maxRetries = config.services.mailtrap?.maxRetries ?? 3
      if (!nonRetryable && attempt < maxRetries) {
        const retryTimeout = config.services.mailtrap?.retryTimeout ?? 1000
        log.warn(`[${this.name}] Email send failed, retrying (${attempt}/${maxRetries})`)
        await new Promise(resolve => setTimeout(resolve, retryTimeout))

        return this.sendWithRetry(payload, attempt + 1)
      }
      throw error
    }
  }
}

export default MailtrapDriver
