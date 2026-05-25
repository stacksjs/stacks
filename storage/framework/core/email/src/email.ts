import type { EmailDriver, EmailMessage, EmailResult } from '@stacksjs/types'
import { config } from '@stacksjs/config'
import { log } from '@stacksjs/logging'
import type { Message } from './types'
import { CaptureEmailDriver } from './drivers/capture'
import { LogEmailDriver } from './drivers/log'
import { MailgunDriver } from './drivers/mailgun'
import { MailtrapDriver } from './drivers/mailtrap'
import { SendGridDriver } from './drivers/sendgrid'
import { SESDriver } from './drivers/ses'
import { SMTPDriver } from './drivers/smtp'
import { findEmailByIdempotencyKey, recordEmailIdempotency } from './idempotency'
import { checkSuppressionFor } from './suppression'

/** Result returned by email handler callbacks */
interface EmailHandlerResult {
  message: string
}

/** Configuration for the sender address */
interface EmailFromAddress {
  name: string
  address: string
}

/** Configuration for the Mail singleton */
interface MailConfig {
  defaultDriver?: string
}

/**
 * Email notification class for defining email notifications
 */
export class Email {
  public name: string
  public subject: string
  /**
   * Recipient(s). Accepts either a single address or an array — the underlying
   * driver fans out a single send across all recipients in one envelope, which
   * matters for batch notifications (booking digests, marketing) where opening
   * one transport per recipient would burn quota.
   */
  public to: string | string[]
  public from?: EmailFromAddress
  public template: string
  public handle?: () => Promise<EmailHandlerResult>
  public onError?: (error: Error) => Promise<EmailHandlerResult>
  public onSuccess?: () => void

  constructor(options: Message) {
    this.name = options.name
    this.subject = options.subject
    this.to = options.to
    this.from = options.from
    this.template = options.template
    this.handle = options.handle
    this.onError = options.onError
    this.onSuccess = options.onSuccess
  }

  private async renderTemplate(): Promise<string> {
    if (!this.template) return ''

    try {
      // Try to load the template file from resources/views/emails
      const { path: p } = await import('@stacksjs/path')
      const templatePath = p.resourcesPath(`views/emails/${this.template}.html`)
      const file = Bun.file(templatePath)
      if (await file.exists()) {
        return await file.text()
      }
    }
    catch {
      // Template file not found, fall back to template as raw HTML
    }

    // If template looks like HTML, use it directly; otherwise wrap it
    if (this.template.includes('<')) {
      return this.template
    }
    return `<p>${this.template}</p>`
  }

  async send(to?: string | string[]): Promise<EmailHandlerResult> {
    const target = to ?? this.to
    const recipients = Array.isArray(target) ? target : (target ? [target] : [])
    if (recipients.length === 0) {
      throw new Error('No recipient specified for email')
    }

    try {
      // Use the mail singleton to send
      await mail.send({
        to: recipients,
        from: this.from || {
          name: config.email.from?.name || 'Stacks',
          address: config.email.from?.address || 'no-reply@stacksjs.com',
        },
        subject: this.subject,
        html: await this.renderTemplate(),
      })

      if (this.onSuccess) {
        this.onSuccess()
      }

      if (this.handle) {
        return this.handle()
      }

      return { message: 'Email sent' }
    }
    catch (error: unknown) {
      if (this.onError) {
        return this.onError(error instanceof Error ? error : new Error(String(error)))
      }
      throw error
    }
  }
}

class Mail {
  private drivers: Map<string, EmailDriver> = new Map()
  private defaultDriver: string

  constructor(options: MailConfig = {}) {
    this.defaultDriver = options.defaultDriver || config.email.default || 'ses'
    this.registerDefaultDrivers()
  }

  private registerDefaultDrivers(): void {
    this.drivers.set('log', new LogEmailDriver())
    this.drivers.set('ses', new SESDriver())
    this.drivers.set('sendgrid', new SendGridDriver())
    this.drivers.set('mailgun', new MailgunDriver())
    this.drivers.set('mailtrap', new MailtrapDriver())
    this.drivers.set('smtp', new SMTPDriver())
    // Tests-only in-memory capture (stacksjs/stacks#1871 M-12). Cheap
    // to register even when unused — the driver only holds an empty
    // array until something calls `send()`.
    this.drivers.set('capture', new CaptureEmailDriver())
  }

  public async send(message: EmailMessage): Promise<EmailResult> {
    const driver = this.drivers.get(this.defaultDriver)

    if (!driver) {
      // Surface the typo helpfully — listing what's actually available
      // is far more useful than a bare "not available". Most of the
      // time this hits because `MAIL_MAILER` got typo'd in .env or the
      // user picked a driver name from outdated docs.
      const available = [...this.drivers.keys()].sort().join(', ')
      throw new Error(
        `Email driver '${this.defaultDriver}' is not registered. `
        + `Available drivers: [${available}]. `
        + `Check config.email.default or the MAIL_MAILER environment variable.`,
      )
    }

    // Idempotency-key short-circuit (stacksjs/stacks#1871 M-8). A
    // retry with the same key returns the cached EmailResult from
    // the first successful send instead of re-dispatching to the
    // driver. Both the lookup and the recording silently degrade
    // when the email_idempotency table isn't migrated yet — same
    // opt-in pattern as #1879 Co-3's order dedup.
    if (message.idempotencyKey) {
      const cached = await findEmailByIdempotencyKey(message.idempotencyKey)
      if (cached) return cached
    }

    // Suppression check (stacksjs/stacks#1880). Runs AFTER
    // idempotency: a suppressed retry of a previously-successful
    // send should still return the cached "yes I sent it" result —
    // the suppression only affects NEW dispatches. Suppression
    // check itself is opt-in (warns and degrades when the
    // email_suppressions table isn't migrated).
    const suppressionType = await checkSuppressionForFirstRecipient(message)
    if (suppressionType) {
      return {
        success: false,
        message: `suppressed:${suppressionType}`,
        provider: 'suppression',
      }
    }

    const defaultFrom: EmailFromAddress = {
      name: config.email.from?.name || 'Stacks',
      address: config.email.from?.address || 'no-reply@stacksjs.com',
    }

    const result = await driver.send({
      ...message,
      from: message.from || defaultFrom,
    })

    // Record AFTER the successful dispatch so a driver failure
    // doesn't lock the key — the caller can retry. Failed results
    // are filtered inside recordEmailIdempotency.
    if (message.idempotencyKey) {
      await recordEmailIdempotency(message.idempotencyKey, message, result)
    }

    return result
  }

  // Create a new Mail instance with a different driver (doesn't mutate the singleton)
  public use(driver: string): Mail {
    if (!this.drivers.has(driver)) {
      throw new Error(`Email driver '${driver}' is not available`)
    }
    const instance = new Mail({ defaultDriver: driver })
    return instance
  }

  /**
   * Queue an email for background sending via the job system.
   * Falls back to synchronous send if the queue system isn't loaded
   * or the dispatch fails; the failure is logged so a dropped queue
   * doesn't silently degrade to inline sends without anyone noticing
   * (stacksjs/stacks#1871 M-11).
   */
  public async queue(message: EmailMessage): Promise<void> {
    await this.dispatchOrFallback(message, async () => {
      const { job } = await import('@stacksjs/queue')
      await job('SendEmail', { message, driver: this.defaultDriver })
        .onQueue('emails')
        .dispatch()
    }, { context: 'queue' })
  }

  /**
   * Queue an email for sending after a delay (in seconds).
   */
  public async later(delaySeconds: number, message: EmailMessage): Promise<void> {
    await this.dispatchOrFallback(message, async () => {
      const { job } = await import('@stacksjs/queue')
      await job('SendEmail', { message, driver: this.defaultDriver })
        .onQueue('emails')
        .delay(delaySeconds)
        .dispatch()
    }, { context: 'later', delaySeconds })
  }

  /**
   * Queue an email on a specific named queue.
   */
  public async queueOn(queueName: string, message: EmailMessage): Promise<void> {
    await this.dispatchOrFallback(message, async () => {
      const { job } = await import('@stacksjs/queue')
      await job('SendEmail', { message, driver: this.defaultDriver })
        .onQueue(queueName)
        .dispatch()
    }, { context: 'queueOn', queueName })
  }

  /**
   * Run the queue-dispatch closure; if it throws (queue package not
   * loaded, broker connection lost, serializer crash, …) log the
   * failure and fall back to a synchronous send. Previously the
   * dispatch error was swallowed and apps had no signal that their
   * background-send pipeline had silently degraded to inline sends —
   * worth knowing before a worker's worth of sends starts blocking
   * the request thread. See stacksjs/stacks#1871 M-11.
   */
  private async dispatchOrFallback(
    message: EmailMessage,
    dispatch: () => Promise<void>,
    logExtra: Record<string, unknown>,
  ): Promise<void> {
    try {
      await dispatch()
      return
    }
    catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      log.warn(
        '[email] Queue dispatch failed; falling back to synchronous send. '
        + 'Background email pipeline is degraded — check the queue worker / broker.',
        { ...logExtra, reason },
      )
    }
    await this.send(message)
  }
}

/**
 * Walk every recipient on a message (to / cc / bcc) and consult
 * the suppression list. Returns the matched suppression type for
 * the FIRST suppressed recipient so the caller can surface a
 * structured "rejected" result. Returns `null` when all recipients
 * pass the policy check.
 *
 * Short-circuits on first match — a 100-recipient broadcast with
 * one suppressed address is still a fast no-op rather than 100
 * round-trips. See stacksjs/stacks#1880.
 */
async function checkSuppressionForFirstRecipient(message: EmailMessage): Promise<string | null> {
  const recipients = collectRecipientAddresses(message)
  if (recipients.length === 0) return null
  for (const addr of recipients) {
    const matched = await checkSuppressionFor(addr, message.tag)
    if (matched) return matched
  }
  return null
}

/**
 * Flatten the message's recipient fields (to / cc / bcc) into a
 * single string-list. Tolerates the four shapes the framework
 * accepts: string, string[], EmailAddress, EmailAddress[].
 */
function collectRecipientAddresses(message: EmailMessage): string[] {
  const out: string[] = []
  const pushOne = (v: unknown) => {
    if (typeof v === 'string') { out.push(v); return }
    if (v && typeof v === 'object' && 'address' in v && typeof (v as { address: unknown }).address === 'string')
      out.push((v as { address: string }).address)
  }
  for (const field of ['to', 'cc', 'bcc'] as const) {
    const v = (message as unknown as Record<string, unknown>)[field]
    if (!v) continue
    if (Array.isArray(v)) {
      for (const item of v) pushOne(item)
    }
    else {
      pushOne(v)
    }
  }
  return out
}

// Export a singleton instance — reads default driver from config lazily so
// module-load order doesn't matter. Reading `config.email.default` here at
// eval time hits a TDZ when the auto-imports barrel pulls in app/Jobs files
// (which import @stacksjs/email) while @stacksjs/config is still resolving
// its `await import('~/config/*')` chain. Deferring the read to first method
// call sidesteps the cycle entirely without changing the public API.
let _mail: Mail | undefined
function getMail(): Mail {
  if (!_mail) {
    const driver = (config as any)?.email?.default
      || process.env.MAIL_MAILER
      || 'ses'
    _mail = new Mail({ defaultDriver: driver as any })
  }
  return _mail
}

export const mail: Mail = new Proxy({} as Mail, {
  get(_t, prop) {
    return (getMail() as any)[prop]
  },
  set(_t, prop, value) {
    ;(getMail() as any)[prop] = value
    return true
  },
}) as Mail
