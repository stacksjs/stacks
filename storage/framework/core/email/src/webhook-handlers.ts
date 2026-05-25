/**
 * High-level webhook processors (stacksjs/stacks#1881).
 *
 * Each `handle<Provider>Webhook(req, config)` function does the
 * full pipeline:
 *
 *   1. Read the raw request body (signature verification needs the
 *      exact bytes the provider signed — not the re-serialized
 *      output of req.json())
 *   2. Verify the provider's signature; reject 401 on failure
 *   3. Parse the event id; consult `email_webhook_events` for dedup
 *   4. Classify the event (hard-bounce vs soft, complaint, etc.)
 *   5. Record a suppression for hard bounces + complaints +
 *      unsubscribes via the #1880 `suppress()` helper
 *   6. Fire the framework events listeners subscribe to
 *
 * The route handlers in `defaults/routes/email-webhooks.ts` are
 * thin shells that call these functions and return the
 * appropriate HTTP response.
 */

import { Buffer } from 'node:buffer'
import { suppress } from './suppression'
import { recordWebhookEventOrSkip } from './webhook-dedup'
import type { EmailEventClassification, EmailEventPayload } from './webhook-events'
import {
  emitEmailBounceHard,
  emitEmailBounceSoft,
  emitEmailComplaint,
  emitEmailUnsubscribe,
  suppressionTypeFor,
} from './webhook-events'
import type { SignatureVerification } from './webhook-signatures'
import {
  verifyMailgunSignature,
  verifyPostmarkAuth,
  verifySendgridSignature,
  verifySesSnsSignature,
} from './webhook-signatures'

export interface WebhookResult {
  status: number
  body: { ok: boolean, reason?: string, processed?: boolean, classification?: EmailEventClassification }
}

const OK_DUPLICATE: WebhookResult = { status: 200, body: { ok: true, processed: false, reason: 'duplicate' } }

function unauthorized(reason: string): WebhookResult {
  return { status: 401, body: { ok: false, reason } }
}

function badRequest(reason: string): WebhookResult {
  return { status: 400, body: { ok: false, reason } }
}

/**
 * Side-effect helper invoked after a verified, deduplicated event:
 *   - records a suppression for hard-bounce / complaint / unsubscribe
 *   - fires the appropriate framework event
 *
 * Soft bounces are NOT auto-suppressed (the next send may succeed)
 * but they DO fire the event so listeners can update retry policy.
 */
async function dispatchClassifiedEvent(
  classification: EmailEventClassification,
  payload: EmailEventPayload,
): Promise<void> {
  const suppressionType = suppressionTypeFor(classification)
  if (suppressionType) {
    await suppress(payload.email, suppressionType, payload.reason)
  }

  switch (classification) {
    case 'bounce-hard': await emitEmailBounceHard(payload); break
    case 'bounce-soft': await emitEmailBounceSoft(payload); break
    case 'complaint':   await emitEmailComplaint(payload);  break
    case 'unsubscribe': await emitEmailUnsubscribe(payload); break
    case 'delivered':   /* no suppression; no built-in emit yet */ break
  }
}

// =============================================================================
// Mailgun
// =============================================================================

interface MailgunWebhookPayload {
  signature: { timestamp: string, token: string, signature: string }
  'event-data': {
    id: string
    event: 'failed' | 'complained' | 'unsubscribed' | 'delivered' | string
    severity?: 'temporary' | 'permanent'
    recipient: string
    reason?: string
    [k: string]: unknown
  }
}

export interface MailgunWebhookConfig {
  signingKey: string
  toleranceSeconds?: number
}

export async function handleMailgunWebhook(rawBody: string, config: MailgunWebhookConfig): Promise<WebhookResult> {
  let parsed: MailgunWebhookPayload
  try { parsed = JSON.parse(rawBody) as MailgunWebhookPayload }
  catch { return badRequest('invalid-json') }

  const sig = parsed.signature
  const event = parsed['event-data']
  if (!sig || !event) return badRequest('missing-fields')

  const v = verifyMailgunSignature({
    timestamp: sig.timestamp,
    token: sig.token,
    signature: sig.signature,
    signingKey: config.signingKey,
    toleranceSeconds: config.toleranceSeconds,
  })
  if (!v.ok) return unauthorized(v.reason)

  const fresh = await recordWebhookEventOrSkip('mailgun', event.id)
  if (!fresh) return OK_DUPLICATE

  const classification = classifyMailgunEvent(event.event, event.severity)
  if (!classification) return { status: 200, body: { ok: true, processed: false, reason: 'unhandled-event' } }

  await dispatchClassifiedEvent(classification, {
    email: event.recipient,
    provider: 'mailgun',
    reason: event.reason,
    raw: event,
  })

  return { status: 200, body: { ok: true, processed: true, classification } }
}

function classifyMailgunEvent(event: string, severity: string | undefined): EmailEventClassification | null {
  switch (event) {
    case 'failed':       return severity === 'temporary' ? 'bounce-soft' : 'bounce-hard'
    case 'complained':   return 'complaint'
    case 'unsubscribed': return 'unsubscribe'
    case 'delivered':    return 'delivered'
    default:             return null
  }
}

// =============================================================================
// Postmark
// =============================================================================

interface PostmarkWebhookPayload {
  RecordType: 'Bounce' | 'SpamComplaint' | 'SubscriptionChange' | 'Delivery' | string
  MessageID?: string
  ID?: number | string
  Email?: string
  Recipient?: string
  Type?: string
  TypeCode?: number
  Description?: string
  SuppressSending?: boolean
  [k: string]: unknown
}

export interface PostmarkWebhookConfig {
  username: string
  password: string
  ipAllowlist?: ReadonlyArray<string>
}

export async function handlePostmarkWebhook(
  rawBody: string,
  authorizationHeader: string | null,
  sourceIp: string | undefined,
  config: PostmarkWebhookConfig,
): Promise<WebhookResult> {
  const v = verifyPostmarkAuth({
    authorizationHeader,
    expectedUsername: config.username,
    expectedPassword: config.password,
    sourceIp,
    ipAllowlist: config.ipAllowlist,
  })
  if (!v.ok) return unauthorized(v.reason)

  let parsed: PostmarkWebhookPayload
  try { parsed = JSON.parse(rawBody) as PostmarkWebhookPayload }
  catch { return badRequest('invalid-json') }

  const eventId = String(parsed.ID ?? parsed.MessageID ?? '')
  const email = String(parsed.Email ?? parsed.Recipient ?? '')
  if (!email) return badRequest('missing-recipient')

  const fresh = await recordWebhookEventOrSkip('postmark', eventId)
  if (!fresh) return OK_DUPLICATE

  const classification = classifyPostmarkEvent(parsed)
  if (!classification) return { status: 200, body: { ok: true, processed: false, reason: 'unhandled-event' } }

  await dispatchClassifiedEvent(classification, {
    email,
    provider: 'postmark',
    reason: parsed.Description,
    raw: parsed,
  })
  return { status: 200, body: { ok: true, processed: true, classification } }
}

function classifyPostmarkEvent(msg: PostmarkWebhookPayload): EmailEventClassification | null {
  switch (msg.RecordType) {
    case 'Bounce':
      // Postmark TypeCode === 1 is hard bounce; 2-7 are soft variants
      // (transient SMTP, mailbox-full, etc.). Anything else falls through.
      return msg.TypeCode === 1 ? 'bounce-hard' : 'bounce-soft'
    case 'SpamComplaint':       return 'complaint'
    case 'SubscriptionChange':  return msg.SuppressSending ? 'unsubscribe' : null
    case 'Delivery':            return 'delivered'
    default:                    return null
  }
}

// =============================================================================
// SES (via SNS)
// =============================================================================

interface SesNotificationPayload {
  notificationType: 'Bounce' | 'Complaint' | 'Delivery' | string
  bounce?: {
    bounceType: 'Permanent' | 'Transient' | 'Undetermined'
    bouncedRecipients: Array<{ emailAddress: string, diagnosticCode?: string }>
  }
  complaint?: {
    complainedRecipients: Array<{ emailAddress: string }>
    complaintFeedbackType?: string
  }
  delivery?: {
    recipients: string[]
  }
}

export interface SesWebhookConfig {
  /**
   * Optional override for the cert-URL host regex. Default matches
   * `sns.<region>.amazonaws.com`. Override only if you proxy SNS
   * through your own infrastructure.
   */
  certUrlHostAllowlist?: RegExp
  /**
   * Inject a cert fetcher for tests / proxied environments. Default
   * uses the global fetch.
   */
  fetchCert?: (url: string) => Promise<string>
  /**
   * When `true`, SubscriptionConfirmation messages will GET the
   * `SubscribeURL` automatically to confirm the subscription. Set
   * `false` to require manual confirmation. Default `true`.
   */
  autoConfirmSubscriptions?: boolean
}

export async function handleSesWebhook(rawBody: string, config: SesWebhookConfig = {}): Promise<WebhookResult> {
  let snsMessage: import('./webhook-signatures').SesSnsSignatureInput['message']
  try { snsMessage = JSON.parse(rawBody) }
  catch { return badRequest('invalid-json') }

  const v = await verifySesSnsSignature({
    message: snsMessage,
    certUrlHostAllowlist: config.certUrlHostAllowlist,
    fetchCert: config.fetchCert,
  })
  if (!v.ok) return unauthorized(v.reason)

  // Handle SNS topic management messages
  if (snsMessage.Type === 'SubscriptionConfirmation') {
    if (config.autoConfirmSubscriptions !== false && snsMessage.SubscribeURL) {
      // GET the SubscribeURL to complete the subscription handshake
      try { await fetch(snsMessage.SubscribeURL) }
      catch { /* topic-config issue; operator can confirm manually */ }
    }
    return { status: 200, body: { ok: true, processed: true, reason: 'subscription-confirmed' as never } }
  }
  if (snsMessage.Type === 'UnsubscribeConfirmation') {
    return { status: 200, body: { ok: true, processed: true, reason: 'subscription-removed' as never } }
  }

  // Notification — parse the inner SES message
  let innerMessage: SesNotificationPayload
  try { innerMessage = JSON.parse(snsMessage.Message) }
  catch { return badRequest('invalid-inner-json') }

  const fresh = await recordWebhookEventOrSkip('ses', snsMessage.MessageId)
  if (!fresh) return OK_DUPLICATE

  // SES bounces / complaints can list multiple recipients. We
  // dispatch one event per recipient so listeners don't have to
  // unpack the SES envelope themselves.
  const dispatched: EmailEventClassification[] = []
  if (innerMessage.notificationType === 'Bounce' && innerMessage.bounce) {
    const classification: EmailEventClassification = innerMessage.bounce.bounceType === 'Permanent' ? 'bounce-hard' : 'bounce-soft'
    for (const r of innerMessage.bounce.bouncedRecipients) {
      await dispatchClassifiedEvent(classification, {
        email: r.emailAddress,
        provider: 'ses',
        reason: r.diagnosticCode,
        raw: innerMessage,
      })
      dispatched.push(classification)
    }
  }
  else if (innerMessage.notificationType === 'Complaint' && innerMessage.complaint) {
    for (const r of innerMessage.complaint.complainedRecipients) {
      await dispatchClassifiedEvent('complaint', {
        email: r.emailAddress,
        provider: 'ses',
        reason: innerMessage.complaint.complaintFeedbackType,
        raw: innerMessage,
      })
      dispatched.push('complaint')
    }
  }
  else if (innerMessage.notificationType === 'Delivery' && innerMessage.delivery) {
    for (const r of innerMessage.delivery.recipients) {
      await dispatchClassifiedEvent('delivered', { email: r, provider: 'ses', raw: innerMessage })
      dispatched.push('delivered')
    }
  }

  return {
    status: 200,
    body: {
      ok: true,
      processed: dispatched.length > 0,
      classification: dispatched[0],
    },
  }
}

// =============================================================================
// SendGrid
// =============================================================================

interface SendgridEvent {
  email: string
  event: 'bounce' | 'dropped' | 'spamreport' | 'unsubscribe' | 'group_unsubscribe' | 'delivered' | string
  sg_event_id?: string
  reason?: string
  type?: string
  [k: string]: unknown
}

export interface SendgridWebhookConfig {
  publicKeyPem: string
  toleranceSeconds?: number
}

export async function handleSendgridWebhook(
  rawBody: string,
  signatureHeader: string | null,
  timestampHeader: string | null,
  config: SendgridWebhookConfig,
): Promise<WebhookResult> {
  const v = verifySendgridSignature({
    body: rawBody,
    signature: signatureHeader,
    timestamp: timestampHeader,
    publicKeyPem: config.publicKeyPem,
    toleranceSeconds: config.toleranceSeconds,
  })
  if (!v.ok) return unauthorized(v.reason)

  let events: SendgridEvent[]
  try { events = JSON.parse(rawBody) as SendgridEvent[] }
  catch { return badRequest('invalid-json') }
  if (!Array.isArray(events)) return badRequest('expected-array')

  // SendGrid posts events in batches. Each entry has its own id;
  // dedup independently so a retry of the batch only re-processes
  // the events that weren't recorded the first time.
  let processed = 0
  const classifications: EmailEventClassification[] = []
  for (const ev of events) {
    if (!ev.email) continue
    const id = ev.sg_event_id ?? `${ev.event}:${ev.email}:${Date.now()}`
    const fresh = await recordWebhookEventOrSkip('sendgrid', id)
    if (!fresh) continue

    const classification = classifySendgridEvent(ev.event, ev.type)
    if (!classification) continue

    await dispatchClassifiedEvent(classification, {
      email: ev.email,
      provider: 'sendgrid',
      reason: ev.reason,
      raw: ev,
    })
    processed++
    classifications.push(classification)
  }

  return {
    status: 200,
    body: { ok: true, processed: processed > 0, classification: classifications[0] },
  }
}

function classifySendgridEvent(event: string, type: string | undefined): EmailEventClassification | null {
  switch (event) {
    case 'bounce':            return type === 'blocked' ? 'bounce-soft' : 'bounce-hard'
    case 'dropped':           return 'bounce-hard'
    case 'spamreport':        return 'complaint'
    case 'unsubscribe':       return 'unsubscribe'
    case 'group_unsubscribe': return 'unsubscribe'
    case 'delivered':         return 'delivered'
    default:                  return null
  }
}
