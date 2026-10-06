import { templateByName } from '@stacksjs/email'

/** One run of a notification email paragraph: text, a link, or a line break. */
export interface EmailBodyPart {
  text?: string
  url?: string
  br?: boolean
}

/** Where a notification leads: the email's button. */
export interface NotificationAction {
  label: string
  url: string
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
 */
export async function notificationEmailHtml(payload: { subject?: string, body: string, action?: NotificationAction }): Promise<string> {
  try {
    const { html } = await templateByName('notification', {
      subject: payload.subject ?? '',
      variables: {
        subject: payload.subject ?? '',
        paragraphs: emailParagraphs(payload.body),
        preheader: String(payload.body ?? '').replace(/\s+/g, ' ').trim().slice(0, 140),
        ...(payload.action?.url ? { actionUrl: payload.action.url, actionLabel: payload.action.label || 'Open' } : {}),
      },
    })
    if (html)
      return html
  }
  catch {
    // The fallback below still carries the message.
  }
  const action = payload.action?.url ? `<p><a href="${escapeHtml(payload.action.url)}">${escapeHtml(payload.action.label || payload.action.url)}</a></p>` : ''
  return `<p>${escapeHtml(payload.body)}</p>${action}`
}

/** The plain-text part, with the action's link spelled out. */
export function notificationEmailText(payload: { body: string, action?: NotificationAction }): string {
  return payload.action?.url ? `${payload.body}\n\n${payload.action.label || 'Open'}: ${payload.action.url}` : payload.body
}
