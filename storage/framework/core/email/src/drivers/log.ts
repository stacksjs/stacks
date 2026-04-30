import type { EmailMessage, EmailResult } from '@stacksjs/types'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { log } from '@stacksjs/logging'
import type { TemplateOptions } from '../template'
import { template } from '../template'
import { BaseEmailDriver } from './base'

/**
 * Local-only email driver that never opens a network socket. Renders
 * the message to disk so devs can inspect it (and tests can read it),
 * and remembers the last N sends in-memory so tests can assert against
 * them without scraping log output.
 *
 * Pick this driver when:
 *   - running tests (no SMTP credentials, deterministic output)
 *   - local development (no AWS/SendGrid setup, no mailbox spam)
 *   - CI smoke tests where we want to assert "an email was sent"
 *
 * In production, use `ses` / `sendgrid` / `mailgun` / `smtp` instead.
 */

interface CapturedEmail extends EmailMessage {
  sentAt: Date
  rendered?: { html?: string, text?: string }
}

const STORE_LIMIT = 100
const captured: CapturedEmail[] = []

export class LogEmailDriver extends BaseEmailDriver {
  public name = 'log'

  // Log destination — defaults to `storage/logs/mail/` so it sits next to
  // the rest of the framework's log output. Tests can override via
  // services.log.path or env LOG_MAIL_DIR.
  private resolveDir(): string {
    const fromEnv = process.env.LOG_MAIL_DIR
    if (fromEnv) return resolve(fromEnv)
    // storage/framework/core/email/src/drivers/log.ts → ../../../../../logs/mail
    return resolve(join(import.meta.dir, '..', '..', '..', '..', '..', 'logs', 'mail'))
  }

  public async send(message: EmailMessage, options?: TemplateOptions): Promise<EmailResult> {
    try {
      this.validateMessage(message)

      let rendered: { html?: string, text?: string } | undefined
      if (message.template) {
        const t = await template(message.template, options)
        if (t) rendered = { html: (t as { html?: string }).html, text: (t as { text?: string }).text }
      }

      const html = rendered?.html ?? message.html
      const text = rendered?.text ?? message.text

      const stamp = new Date()
      const safeSubject = (message.subject || 'no-subject').replace(/[^\w.-]+/g, '-').slice(0, 60)
      const filename = `${stamp.toISOString().replace(/[:.]/g, '-')}-${safeSubject}.html`
      const dir = this.resolveDir()

      try {
        await mkdir(dir, { recursive: true })
        const filePath = join(dir, filename)
        const body = html
          ? html
          : text
            ? `<pre>${escapeHtml(text)}</pre>`
            : '<em>(empty body)</em>'
        const headerBlock = renderHeader({ stamp, message })
        await writeFile(filePath, `${headerBlock}\n${body}\n`)
      }
      catch (err) {
        // The disk write is a convenience for inspection — never let a
        // permission/disk error mask a successful "would-have-sent". The
        // in-memory capture is still authoritative for tests.
        log.warn(`[email:log] could not write inspection file: ${(err as Error).message}`)
      }

      const flatTo = Array.isArray(message.to)
        ? message.to.map(t => typeof t === 'string' ? t : t.address).join(', ')
        : typeof message.to === 'string' ? message.to : (message.to as { address: string }).address
      log.info(`[email:log] would send → ${flatTo} :: ${message.subject}`)

      captured.push({ ...message, sentAt: stamp, rendered })
      if (captured.length > STORE_LIMIT) captured.splice(0, captured.length - STORE_LIMIT)

      return this.handleSuccess(message, `log-${stamp.getTime()}`)
    }
    catch (error) {
      return this.handleError(error, message)
    }
  }

  /**
   * Test helper — returns the most recent captured emails (newest last).
   * Use in feature tests after triggering a flow:
   *
   *   import { LogEmailDriver } from '@stacksjs/email/drivers/log'
   *   await POST('/api/bookings', ...)
   *   const sent = LogEmailDriver.captured()
   *   expect(sent.at(-1)?.subject).toContain('booking')
   */
  public static captured(): readonly CapturedEmail[] {
    return captured
  }

  /**
   * Test helper — clears the captured store. Call between tests to keep
   * assertions isolated.
   */
  public static reset(): void {
    captured.length = 0
  }
}

function renderHeader({ stamp, message }: { stamp: Date, message: EmailMessage }): string {
  const lines = [
    '<!--',
    `  Captured by @stacksjs/email log driver at ${stamp.toISOString()}`,
    `  From:    ${formatAddr(message.from)}`,
    `  To:      ${formatList(message.to)}`,
    message.cc ? `  Cc:      ${formatList(message.cc)}` : null,
    message.bcc ? `  Bcc:     ${formatList(message.bcc)}` : null,
    `  Subject: ${message.subject}`,
    '-->',
  ].filter(Boolean) as string[]
  return lines.join('\n')
}

function formatAddr(v: unknown): string {
  if (!v) return ''
  if (typeof v === 'string') return v
  const o = v as { name?: string, address?: string }
  return o.name ? `${o.name} <${o.address ?? ''}>` : (o.address ?? '')
}

function formatList(v: unknown): string {
  if (Array.isArray(v)) return v.map(formatAddr).join(', ')
  return formatAddr(v)
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c] as string))
}

// Convenience export to mirror the other drivers' module shape — the
// drivers/index.ts re-exports each driver namespace (`export * as log`).
export default LogEmailDriver
