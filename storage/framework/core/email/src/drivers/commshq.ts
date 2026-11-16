import type { EmailAddress, EmailMessage, EmailResult } from '@stacksjs/types'
import { config } from '@stacksjs/config'
import { log } from '@stacksjs/logging'
import type { TemplateOptions } from '../template'
import { templateByName } from '../template'
import { BaseEmailDriver } from './base'

/**
 * Send through CommsHQ, with the key `buddy hq:connect commshq` wrote.
 *
 * CommsHQ sends the message from the app's own domain once that domain is
 * verified, signed with the domain's DKIM key, and from an address of its own
 * until then. The app says who the mail is from; whether that address may be
 * used yet is the service's decision, and its answer says which was used.
 *
 * The key and the origin are `config.services.commshq`, where every HQ
 * service's are. Nothing here reads SMTP settings: an app connected to
 * CommsHQ needs no mail server of its own.
 */

/** Which mail driver an app sends with when nothing more specific was said. */
export function resolveDefaultMailDriver(input: {
  /** `config.email.default`. */
  configured?: string
  /** True when MAIL_MAILER or MAIL_DRIVER is set: the app chose, and that wins. */
  explicit: boolean
  /** `config.services.commshq.key`. */
  commshqKey?: string
  /** `config.services.commshq.mail`: `false` keeps the app's own mailer. */
  commshqMail?: boolean
  environment?: string
}): string {
  if (input.explicit && input.configured)
    return input.configured
  if (input.commshqMail === false)
    return input.configured || 'ses'
  // Connected, and running where mail should really go out. Elsewhere the
  // configured default stands, which for an app is the log driver: a
  // developer's machine must not send real mail because a key is in `.env`.
  if (input.commshqKey && ['production', 'staging'].includes(String(input.environment || '')))
    return 'commshq'
  return input.configured || 'ses'
}

interface CommsHqSendBody {
  from?: { name?: string, address: string }
  to: string[]
  cc?: string[]
  bcc?: string[]
  replyTo?: string[]
  subject: string
  html?: string
  text?: string
  headers?: Record<string, string>
  idempotencyKey?: string
}

export class CommsHqDriver extends BaseEmailDriver {
  public name = 'commshq'

  private settings(): { url: string, key: string } {
    const service = config.services?.commshq
    return {
      url: String(service?.url || process.env.COMMSHQ_URL || 'https://commshq.org').replace(/\/+$/, ''),
      key: String(service?.key || process.env.COMMSHQ_KEY || ''),
    }
  }

  /** What is posted for a message. Kept apart from `send` so it can be read without a network. */
  public body(message: EmailMessage, html: string | undefined): CommsHqSendBody {
    const from: EmailAddress | undefined = message.from ?? (config.email?.from?.address
      ? { name: config.email.from.name, address: config.email.from.address }
      : undefined)
    const replyTo = this.formatAddressList(message.replyTo)
    const cc = this.formatAddresses(message.cc)
    const bcc = this.formatAddresses(message.bcc)
    return {
      ...(from ? { from: { name: from.name, address: from.address } } : {}),
      to: this.formatAddresses(message.to),
      ...(cc.length ? { cc } : {}),
      ...(bcc.length ? { bcc } : {}),
      ...(replyTo.length ? { replyTo } : {}),
      subject: message.subject,
      ...(html ? { html } : {}),
      ...(message.text ? { text: message.text } : {}),
      ...(message.headers && Object.keys(message.headers).length ? { headers: message.headers } : {}),
      ...(message.idempotencyKey ? { idempotencyKey: message.idempotencyKey } : {}),
    }
  }

  public async send(message: EmailMessage, options?: TemplateOptions): Promise<EmailResult> {
    const { url, key } = this.settings()
    log.info('Sending email via CommsHQ...', { provider: this.name, to: message.to, subject: message.subject })

    try {
      this.validateMessage(message)
      if (!key)
        throw new Error('[commshq] No key is configured. Run `buddy hq:connect commshq`, which writes COMMSHQ_KEY.')
      // Said here and not left to the service: a message that silently lost
      // its attachment is worse than one that was not sent.
      if (message.attachments?.length)
        throw new Error('[commshq] Attachments are not supported by the CommsHQ send endpoint yet. Send this message with the smtp driver: mail.use(\'smtp\').')

      let html = message.html
      if (message.template) {
        const rendered = await templateByName(message.template, options)
        if (rendered && 'html' in rendered)
          html = rendered.html
      }

      const response = await fetch(`${url}/api/v1/send`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(this.body(message, html)),
        signal: AbortSignal.timeout(20_000),
      })
      const answer = await response.json().catch(() => null) as { id?: string, error?: string } | null
      if (!response.ok)
        throw new Error(`[commshq] ${answer?.error || `The service answered ${response.status}`}`)

      return this.handleSuccess(message, answer?.id)
    }
    catch (error) {
      return this.handleError(error, message)
    }
  }
}

export default CommsHqDriver
