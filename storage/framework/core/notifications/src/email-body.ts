import type { EmailMessage } from '@stacksjs/types'
import { templateByName } from '@stacksjs/email'

/**
 * One run of a notification email paragraph: text, a link, or a line break.
 * A type, not an interface: template variables take index-signature types,
 * which an interface does not satisfy.
 */
// eslint-disable-next-line ts/consistent-type-definitions
export type EmailBodyPart = {
  text?: string
  url?: string
  br?: boolean
}

/** Where a notification leads: the email's button. */
export interface NotificationAction {
  label: string
  url: string
}

/**
 * The two ways out a marketing notification carries (see `notify()`'s
 * `payload.unsubscribe`).
 */
export interface NotificationUnsubscribe {
  /** The footer link: usually a page that asks before it unsubscribes. */
  url: string
  /**
   * An endpoint that unsubscribes on a POST with no further interaction
   * (RFC 8058). When set, it becomes the `List-Unsubscribe` URL and the
   * email also carries `List-Unsubscribe-Post: List-Unsubscribe=One-Click`,
   * which is what Gmail and Apple Mail need to show their own button.
   * Without it, `List-Unsubscribe` points at `url`.
   */
  oneClickUrl?: string
  /** Where the person manages every preference, linked beside Unsubscribe. */
  preferencesUrl?: string
  /** The footer sentence. Defaults to {@link DEFAULT_UNSUBSCRIBE_NOTICE}. */
  notice?: string
}

/** The footer sentence of an email with an unsubscribe link, unless the payload names its own. */
export const DEFAULT_UNSUBSCRIBE_NOTICE = 'You are receiving this because these emails are turned on in your settings.'

/**
 * The line a marketing text ends with, unless the payload names its own
 * (`smsOptOut`). Carriers expect opt-out instructions on marketing texts, and
 * STOP is the keyword every provider and `@stacksjs/sms` honour.
 */
export const DEFAULT_SMS_OPT_OUT = 'Reply STOP to opt out.'

/** What the email builders read from a notification payload. */
export interface NotificationEmailPayload {
  subject?: string
  body: string
  action?: NotificationAction
  unsubscribe?: NotificationUnsubscribe
  headers?: Record<string, string>
}

const URL_PATTERN = /https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]]/g

/**
 * A plain-text notification body as the paragraphs of its email. Blank lines
 * separate paragraphs, a single newline stays a line break, and an address is
 * a link. The template escapes every part, so a body is never HTML.
 */
export function emailParagraphs(body: string): EmailBodyPart[][] {
  return String(body ?? '')
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map(paragraph => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => {
      const parts: EmailBodyPart[] = []
      paragraph.split('\n').forEach((line, index) => {
        if (index > 0)
          parts.push({ br: true })
        let last = 0
        for (const match of line.matchAll(URL_PATTERN)) {
          if (match.index! > last)
            parts.push({ text: line.slice(last, match.index) })
          parts.push({ url: match[0] })
          last = match.index! + match[0].length
        }
        if (last < line.length)
          parts.push({ text: line.slice(last) })
      })
      return parts
    })
}

function escapeHtml(s: string): string {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c] as string))
}

/**
 * The HTML a notification is emailed as: the `notification` template (an
 * app's own resources/emails/notification first, else the framework's), in
 * the same layout as every other Stacks email. It used to be the body in a
 * bare `<p>`, which mail clients showed as unstyled text with dead links.
 * Falls back to that only if the template cannot be rendered.
 *
 * With `unsubscribe`, the footer says why the email came and links to
 * Unsubscribe (and the preferences page) instead of "do not reply".
 */
export async function notificationEmailHtml(payload: NotificationEmailPayload): Promise<string> {
  const unsubscribe = payload.unsubscribe?.url ? payload.unsubscribe : undefined
  try {
    const { html } = await templateByName('notification', {
      subject: payload.subject ?? '',
      variables: {
        subject: payload.subject ?? '',
        paragraphs: emailParagraphs(payload.body),
        preheader: String(payload.body ?? '').replace(/\s+/g, ' ').trim().slice(0, 140),
        ...(payload.action?.url ? { actionUrl: payload.action.url, actionLabel: payload.action.label || 'Open' } : {}),
        ...(unsubscribe
          ? {
              unsubscribeUrl: unsubscribe.url,
              unsubscribeNotice: unsubscribe.notice || DEFAULT_UNSUBSCRIBE_NOTICE,
              ...(unsubscribe.preferencesUrl ? { preferencesUrl: unsubscribe.preferencesUrl } : {}),
            }
          : {}),
      },
    })
    if (html)
      return html
  }
  catch {
    // The fallback below still carries the message.
  }
  const action = payload.action?.url ? `<p><a href="${escapeHtml(payload.action.url)}">${escapeHtml(payload.action.label || payload.action.url)}</a></p>` : ''
  const footer = unsubscribe ? `<p>${escapeHtml(unsubscribe.notice || DEFAULT_UNSUBSCRIBE_NOTICE)} <a href="${escapeHtml(unsubscribe.url)}">Unsubscribe</a></p>` : ''
  return `<p>${escapeHtml(payload.body)}</p>${action}${footer}`
}

/** The plain-text part, with the action's link and any unsubscribe link spelled out. */
export function notificationEmailText(payload: { body: string, action?: NotificationAction, unsubscribe?: NotificationUnsubscribe }): string {
  let text = payload.action?.url ? `${payload.body}\n\n${payload.action.label || 'Open'}: ${payload.action.url}` : payload.body
  if (payload.unsubscribe?.url)
    text += `\n\n${payload.unsubscribe.notice || DEFAULT_UNSUBSCRIBE_NOTICE}\nUnsubscribe: ${payload.unsubscribe.url}`
  return text
}

/**
 * `List-Unsubscribe` for a payload's unsubscribe links (RFC 2369), plus
 * `List-Unsubscribe-Post` when there is a one-click endpoint (RFC 8058).
 * Empty without `unsubscribe`.
 */
export function listUnsubscribeHeaders(unsubscribe?: NotificationUnsubscribe): Record<string, string> {
  if (!unsubscribe?.url)
    return {}
  return {
    'List-Unsubscribe': `<${unsubscribe.oneClickUrl || unsubscribe.url}>`,
    ...(unsubscribe.oneClickUrl ? { 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } : {}),
  }
}

/**
 * Everything `notify()` hands the mailer for one email: the text and HTML
 * parts, and the payload's own headers with the unsubscribe ones on top.
 */
export async function notificationEmailMessage(to: string, payload: NotificationEmailPayload): Promise<EmailMessage> {
  const headers = { ...payload.headers, ...listUnsubscribeHeaders(payload.unsubscribe) }
  return {
    to,
    subject: payload.subject ?? '',
    text: notificationEmailText(payload),
    html: await notificationEmailHtml(payload),
    ...(Object.keys(headers).length ? { headers } : {}),
  }
}

/** The longest sender name a text starts with; a longer one is cut. */
export const SMS_SENDER_MAX_LENGTH = 30

/**
 * The name a text starts with, as `{sender}: `: whitespace collapsed, and cut
 * to {@link SMS_SENDER_MAX_LENGTH} characters so a long name cannot eat the
 * message (no ellipsis: one character outside GSM-7 doubles the cost of the
 * whole text). Empty when there is no name.
 */
export function smsSenderPrefix(sender?: string): string {
  const name = String(sender ?? '').replace(/\s+/g, ' ').trim().slice(0, SMS_SENDER_MAX_LENGTH).trim()
  return name ? `${name}: ` : ''
}

/**
 * What a notification texts. With `smsSender` it starts with the sender's
 * name, so a text from a shared number says who it is from (carriers expect
 * the brand in every message). A `marketing` text ends with
 * {@link DEFAULT_SMS_OPT_OUT} on its own line; `smsOptOut` replaces that line
 * (and adds it to any category), and `false` leaves it out. A body that
 * already starts with the name, or already contains the line, is left alone.
 */
export function notificationSmsBody(payload: { body: string, smsSender?: string, smsOptOut?: string | false }, category?: string): string {
  let body = String(payload.body ?? '')
  const prefix = smsSenderPrefix(payload.smsSender)
  if (prefix && !body.trimStart().toLowerCase().startsWith(prefix.trim().toLowerCase()))
    body = `${prefix}${body.trimStart()}`
  if (payload.smsOptOut === false)
    return body
  const line = typeof payload.smsOptOut === 'string' ? payload.smsOptOut.trim() : category === 'marketing' ? DEFAULT_SMS_OPT_OUT : ''
  if (!line || body.toLowerCase().includes(line.toLowerCase()))
    return body
  return `${body.trimEnd()}\n\n${line}`
}
