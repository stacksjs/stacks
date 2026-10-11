import process from 'node:process'
import { verifyTwilioWebhook } from './compliance'
import { type InboundSmsKind, inboundSmsReply, matchSmsKeyword, PROVIDER_HANDLED_LOCALE, type SmsKeywordMatch } from './keywords'
import { normalizePhone, optInPhone, optOutPhone } from './opt-out'

/**
 * A Twilio "a message comes in" webhook, end to end: verify Twilio's
 * signature, read the message, record STOP/START in `sms_opt_outs`, tell the
 * app (so it can switch its own preferences), and answer with TwiML.
 *
 * ```ts
 * // routes: route.post('/sms/inbound', 'Actions/SmsInboundAction').skipCsrf()
 * export default new Action({ method: 'POST', handle: request => handleTwilioInbound(request, {
 *   onConsentChange: ({ phone, kind }) => setMarketingSms(phone, kind === 'start'),
 * }) })
 * ```
 *
 * Point the number's (or messaging service's) incoming-message webhook at
 * that route, as an HTTP POST.
 */

export interface InboundConsentChange {
  /** The sender, normalized to E.164 the way `sms_opt_outs` stores it. */
  phone: string
  kind: 'stop' | 'start'
  /** The language of the keyword (`de` for STOPP), when known. */
  locale?: string
}

export interface InboundSmsMessage {
  from: string
  to: string
  body: string
  messageId?: string
  kind: InboundSmsKind
  /** The language of the keyword, when the message was one. */
  locale?: string
}

export interface TwilioInboundOptions {
  /** Defaults to `TWILIO_AUTH_TOKEN`. Without one every request is refused (503). */
  authToken?: string
  /**
   * The exact URL Twilio posts to, which is what it signs. Defaults to
   * `APP_URL` plus the request's path and query, because behind a proxy the
   * request's own URL is the internal one.
   */
  publicUrl?: string
  /**
   * Answer STOP, START and HELP with a compliance message, in the keyword's
   * language. Off by default: Twilio's own opt-out handling already replies
   * to the English keywords on long codes, toll-free numbers and messaging
   * services, and a second reply reaches the person twice. `'unhandled'`
   * replies only to the keywords Twilio does not know (the German STOPP,
   * say), so every keyword gets exactly one confirmation. `true` replies to
   * all of them, for where Twilio's handling is disabled.
   */
  reply?: boolean | 'unhandled'
  appName?: string
  helpContact?: string
  /** STOP or START was recorded for `phone`. Update the app's own consent here. */
  onConsentChange?: (change: InboundConsentChange) => unknown
  /** Every verified message, keywords included, after consent is recorded. */
  onMessage?: (message: InboundSmsMessage) => unknown
}

function twiml(message?: string): Response {
  const escaped = message?.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&apos;' }[c] as string))
  const body = escaped ? `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escaped}</Message></Response>` : '<?xml version="1.0" encoding="UTF-8"?><Response></Response>'
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/xml; charset=utf-8' } })
}

function signedUrl(request: Request, publicUrl?: string): string {
  if (publicUrl)
    return publicUrl
  const url = new URL(request.url, 'http://localhost')
  const base = String(process.env.APP_URL || '').replace(/\/$/, '')
  return base ? `${base}${url.pathname}${url.search}` : url.href
}

/**
 * Which keyword a message is, and whether Twilio handles it itself. Twilio's
 * Advanced Opt-Out names it in `OptOutType` (and knows any custom keywords
 * configured there); otherwise `SMS_KEYWORDS` decides, in every language it
 * has, and only the English ones are Twilio's.
 */
export function inboundSmsKind(fields: Record<string, string | undefined>): SmsKeywordMatch & { providerHandled: boolean } {
  const optOutType = String(fields.OptOutType || '').toUpperCase()
  const match = matchSmsKeyword(fields.Body ?? '')
  if (optOutType === 'STOP' || optOutType === 'START' || optOutType === 'HELP') {
    const kind = optOutType.toLowerCase() as InboundSmsKind
    // Twilio recognised it, so Twilio has confirmed it, whatever the word.
    return { ...(match.kind === kind ? match : { keyword: match.keyword }), kind, providerHandled: true }
  }
  return { ...match, providerHandled: match.locale === PROVIDER_HANDLED_LOCALE }
}

function shouldReply(match: { kind: InboundSmsKind, providerHandled: boolean }, reply: TwilioInboundOptions['reply']): boolean {
  if (match.kind === 'message' || !reply)
    return false
  return reply === true || !match.providerHandled
}

export async function handleTwilioInbound(request: Request, options: TwilioInboundOptions = {}): Promise<Response> {
  const authToken = options.authToken ?? process.env.TWILIO_AUTH_TOKEN ?? ''
  if (!authToken)
    return new Response('Inbound SMS is not configured', { status: 503 })

  const fields: Record<string, string> = {}
  for (const [key, value] of new URLSearchParams(await request.text()))
    fields[key] = value

  const signature = request.headers.get('x-twilio-signature') || ''
  if (!verifyTwilioWebhook(signedUrl(request, options.publicUrl), fields, signature, authToken))
    return new Response('Invalid signature', { status: 403 })

  const from = normalizePhone(fields.From ?? '')
  if (!from)
    return twiml()

  const match = inboundSmsKind(fields)
  const { kind } = match
  if (kind === 'stop')
    await optOutPhone(from)
  if (kind === 'start')
    await optInPhone(from)
  if (kind === 'stop' || kind === 'start')
    await options.onConsentChange?.({ phone: from, kind, ...(match.locale ? { locale: match.locale } : {}) })
  await options.onMessage?.({ from, to: fields.To ?? '', body: fields.Body ?? '', messageId: fields.MessageSid ?? fields.SmsSid, kind, ...(match.locale ? { locale: match.locale } : {}) })

  return twiml(shouldReply(match, options.reply) ? inboundSmsReply(kind, { ...options, locale: match.locale }) : undefined)
}
