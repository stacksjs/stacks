import { db, sqlDateTime } from '@stacksjs/database/runtime'

/**
 * US SMS compliance: STOP must stop, START must restart, HELP must answer.
 * Carriers enforce this at the shortcode/10DLC level, but the sender is
 * still required to honor it in their own records - and a school that
 * keeps texting after STOP is one parent complaint from a filtered number.
 *
 * Opt-outs are keyed by PHONE NUMBER, not user: the reply comes from a
 * handset, and whoever holds it has spoken for it regardless of which
 * family member the CRM thinks owns it.
 *
 * Table: `sms_opt_outs` (phone unique, opted_out_at, reason).
 */

/** The exact keyword set carriers recognize, per CTIA guidelines. */
const STOP_WORDS = new Set(['stop', 'stopall', 'unsubscribe', 'cancel', 'end', 'quit'])
const START_WORDS = new Set(['start', 'yes', 'unstop'])
const HELP_WORDS = new Set(['help', 'info'])

export type InboundSmsKind = 'stop' | 'start' | 'help' | 'message'

export interface InboundSmsResult {
  kind: InboundSmsKind
  /** A reply the webhook should send back, when compliance requires one. */
  reply?: string
}

export function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, '')
  // Normalize bare US 10-digit to E.164 so 'STOP' from (310) 555-0199 and
  // +13105550199 land on one row.
  if (/^\d{10}$/.test(digits))
    return `+1${digits}`
  if (/^1\d{10}$/.test(digits))
    return `+${digits}`
  return digits
}

export function classifyInboundSms(body: string): InboundSmsKind {
  const word = body.trim().toLowerCase().split(/\s+/)[0] ?? ''
  if (STOP_WORDS.has(word))
    return 'stop'
  if (START_WORDS.has(word))
    return 'start'
  if (HELP_WORDS.has(word))
    return 'help'
  return 'message'
}

/**
 * Record that a number replied STOP. Idempotent, and safe under concurrency:
 * one insert that does nothing when the number is already there (`phone` is
 * unique), so a provider retrying its webhook, or two STOPs handled at once,
 * leave exactly one row. The first opt-out's time and reason are kept.
 *
 * It used to delete and re-insert, and two webhooks racing between those two
 * statements made the second insert fail on the unique index: the webhook
 * answered 500 and the provider retried a STOP that had already been recorded.
 */
export async function optOutPhone(phone: string, reason = 'stop-keyword'): Promise<void> {
  const normalized = normalizePhone(phone)
  if (!normalized)
    return

  const now = sqlDateTime(new Date())
  // `ON CONFLICT DO NOTHING` on SQLite and Postgres, `INSERT IGNORE` on MySQL.
  await db.insertOrIgnore('sms_opt_outs', {
    phone: normalized,
    reason,
    opted_out_at: now,
    created_at: now,
    updated_at: now,
  } as never)
}

export async function optInPhone(phone: string): Promise<void> {
  const normalized = normalizePhone(phone)
  if (!normalized)
    return

  await db
    .deleteFrom('sms_opt_outs')
    .where('phone', '=', normalized)
    .execute()
}

/** Check before EVERY non-emergency send. */
export async function isPhoneOptedOut(phone: string): Promise<boolean> {
  const normalized = normalizePhone(phone)
  if (!normalized)
    return false

  const row = await db
    .selectFrom('sms_opt_outs')
    .where('phone', '=', normalized)
    .select(['id'])
    .executeTakeFirst()

  return !!row
}

/** The compliance reply to a keyword, or undefined for an ordinary message. */
export function inboundSmsReply(kind: InboundSmsKind, options: { appName?: string, helpContact?: string } = {}): string | undefined {
  const name = options.appName ?? 'this service'
  if (kind === 'stop')
    return `You are unsubscribed from ${name} texts. No more messages will be sent. Reply START to resubscribe.`
  if (kind === 'start')
    return `You are resubscribed to ${name} texts. Reply STOP to unsubscribe.`
  if (kind === 'help')
    return `${name}: reply STOP to unsubscribe, START to resubscribe.${options.helpContact ? ` Contact: ${options.helpContact}` : ''}`
  return undefined
}

/**
 * Process one inbound SMS (a provider webhook's job): record STOP/START,
 * return the compliance reply to send. Ordinary messages pass through as
 * `kind: 'message'` for the app to route (or ignore). For Twilio,
 * `handleTwilioInbound` does this and the signature check in one call.
 */
export async function handleInboundSms(input: { from: string, body: string }, options: { appName?: string, helpContact?: string } = {}): Promise<InboundSmsResult> {
  const kind = classifyInboundSms(input.body)
  if (kind === 'stop')
    await optOutPhone(input.from)
  if (kind === 'start')
    await optInPhone(input.from)
  const reply = inboundSmsReply(kind, options)
  return reply ? { kind, reply } : { kind }
}
