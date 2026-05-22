/**
 * Shared MIME envelope builder.
 *
 * Used by:
 *   - the SMTP driver to construct the raw `DATA` section of an SMTP
 *     transaction
 *   - the SES driver to construct the body of a `SendRawEmail` call
 *     when the message has attachments or custom headers (the
 *     simpler `SendEmail` shape can't carry either)
 *
 * Centralizing the construction means both drivers agree on the wire
 * format — boundaries, encoding, header names — and a fix to one
 * benefits both. The previous code duplicated the multipart/alternative
 * envelope inside SMTP only, and SES silently dropped attachments
 * entirely (stacksjs/stacks#1871 M-2 / M-3).
 */

import type { EmailAttachment } from '@stacksjs/types'
import { Buffer } from 'node:buffer'

/**
 * Encode an SMTP header value with RFC 2047 base64 encoding when it
 * contains non-ASCII characters. Without this, subjects like
 * "Encore d'idées" or "你好" produce headers that violate RFC 5322
 * (which mandates 7-bit ASCII for headers) and get mangled or rejected
 * by downstream relays.
 */
export function encodeRfc2047IfNeeded(value: string): string {
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(value)) return value
  return `=?UTF-8?B?${Buffer.from(value, 'utf-8').toString('base64')}?=`
}

export interface MimeMessageOptions {
  from: string
  to: string
  cc?: string
  replyTo?: string
  subject: string
  text?: string
  html?: string
  attachments?: EmailAttachment[]
  /**
   * Domain to use in the auto-generated `Message-ID` header. Falls back
   * to `localhost` when omitted.
   */
  messageIdDomain?: string
  /**
   * Pre-filtered map of extra outgoing headers (e.g. List-Unsubscribe).
   * The caller is expected to have already stripped CR/LF-bearing
   * entries via `filterStringHeaders`.
   */
  customHeaders?: Record<string, string>
}

/**
 * Build the full raw bytes for an RFC 5322 / 2045 email message.
 *
 * Returns a single string with CRLF line endings — both SMTP DATA and
 * SES `SendRawEmail.RawMessage.Data` consume this shape directly.
 *
 * Shape decision tree:
 *
 *   no attachments:
 *     - both html+text → multipart/alternative
 *     - one of either   → single-part
 *   with attachments:
 *     - multipart/mixed envelope wrapping the body (alternative or
 *       single-part) + one part per attachment
 */
export function buildMimeMessage(options: MimeMessageOptions): string {
  const {
    from,
    to,
    cc,
    replyTo,
    subject,
    text,
    html,
    attachments,
    messageIdDomain,
    customHeaders,
  } = options
  const lines: string[] = []
  const hasAttachments = !!(attachments && attachments.length > 0)
  const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(2)}`

  lines.push(`From: ${from}`)
  lines.push(`To: ${to}`)
  if (cc) lines.push(`Cc: ${cc}`)
  if (replyTo) lines.push(`Reply-To: ${replyTo}`)
  lines.push(`Subject: ${encodeRfc2047IfNeeded(subject)}`)
  lines.push('MIME-Version: 1.0')
  lines.push(`Date: ${new Date().toUTCString()}`)
  lines.push(`Message-ID: <${Date.now()}.${Math.random().toString(36).substring(2)}@${messageIdDomain || 'localhost'}>`)
  if (customHeaders) {
    for (const [k, v] of Object.entries(customHeaders)) {
      lines.push(`${k}: ${v}`)
    }
  }

  if (hasAttachments) {
    const mixedBoundary = boundary
    const altBoundary = `${boundary}_alt`
    lines.push(`Content-Type: multipart/mixed; boundary="${mixedBoundary}"`)
    lines.push('')
    lines.push(`--${mixedBoundary}`)
    pushBodyParts(lines, { text, html, altBoundary })
    for (const attachment of attachments!) {
      lines.push(`--${mixedBoundary}`)
      pushAttachmentPart(lines, attachment)
    }
    lines.push(`--${mixedBoundary}--`)
  }
  else {
    pushBodyParts(lines, { text, html, altBoundary: boundary })
  }

  return lines.join('\r\n')
}

/**
 * Emit the text/html body portion as either a single-part or a
 * multipart/alternative envelope.
 */
function pushBodyParts(
  lines: string[],
  options: { text?: string, html?: string, altBoundary: string },
): void {
  const { text, html, altBoundary } = options

  if (html && text) {
    lines.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`)
    lines.push('')
    lines.push(`--${altBoundary}`)
    lines.push('Content-Type: text/plain; charset=UTF-8')
    lines.push('Content-Transfer-Encoding: 7bit')
    lines.push('')
    lines.push(text)
    lines.push('')
    lines.push(`--${altBoundary}`)
    lines.push('Content-Type: text/html; charset=UTF-8')
    lines.push('Content-Transfer-Encoding: 7bit')
    lines.push('')
    lines.push(html)
    lines.push('')
    lines.push(`--${altBoundary}--`)
  }
  else if (html) {
    lines.push('Content-Type: text/html; charset=UTF-8')
    lines.push('Content-Transfer-Encoding: 7bit')
    lines.push('')
    lines.push(html)
  }
  else if (text) {
    lines.push('Content-Type: text/plain; charset=UTF-8')
    lines.push('Content-Transfer-Encoding: 7bit')
    lines.push('')
    lines.push(text)
  }
}

/**
 * Emit a single attachment as a base64-encoded MIME part within a
 * multipart/mixed envelope.
 *
 * Always base64-encode regardless of the caller-declared encoding —
 * inline binary in an SMTP DATA section without base64 wrapping
 * trips servers that scan for 8-bit content. Content-Type defaults
 * to `application/octet-stream`. Lines wrap at 76 cols per RFC 2045
 * §6.8 to stay within the SMTP line-length limit.
 */
function pushAttachmentPart(lines: string[], attachment: EmailAttachment): void {
  const contentType = attachment.contentType || 'application/octet-stream'
  const safeFilename = encodeRfc2047IfNeeded(
    attachment.filename.replace(/\\/g, '\\\\').replace(/"/g, '\\"'),
  )
  lines.push(`Content-Type: ${contentType}; name="${safeFilename}"`)
  lines.push(`Content-Disposition: attachment; filename="${safeFilename}"`)
  lines.push('Content-Transfer-Encoding: base64')
  lines.push('')

  const raw = typeof attachment.content === 'string'
    ? Buffer.from(attachment.content, 'utf-8').toString('base64')
    : Buffer.from(attachment.content).toString('base64')
  const wrapped = raw.match(/.{1,76}/g)?.join('\r\n') ?? raw
  lines.push(wrapped)
  lines.push('')
}
